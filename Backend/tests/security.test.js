import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createApp } from "../app.js";
import {
  passwordProblem,
  passwordScore,
} from "../validators/password-policy.js";
import { safeEqual, describeAgent } from "../services/security.service.js";

const rawStatus = (origin, path) =>
  new Promise((resolve, reject) =>
    http
      .get(new URL(origin), { path }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
      .on("error", reject),
  );
async function withApi(options, callback) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("politique de mot de passe : longueur, variété, identifiant, mots courants", () => {
  assert.match(passwordProblem("Court1!"), /12 caractères/);
  assert.match(passwordProblem("toutenminuscules"), /trois types/);
  assert.match(
    passwordProblem("Direction-2026x", { username: "direction" }),
    /nom d’utilisateur/,
  );
  assert.match(passwordProblem("Alhakim-Center-9"), /mot courant/);
  assert.match(passwordProblem("Zzzzz-Formation-7"), /répété/);
  assert.equal(passwordProblem("Vent-Sable-Port-42"), null);
  assert.equal(passwordProblem("x".repeat(129)), "Utilisez au plus 128 caractères.");
  assert.equal(passwordScore(""), 0);
  assert.equal(passwordScore("Vent-Sable-Port-42"), 5);
});

test("comparaison de jetons en temps constant", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test("appareil lisible à partir du user-agent", () => {
  assert.equal(
    describeAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0",
    ),
    "Edge · Windows",
  );
  assert.equal(describeAgent(""), "Navigateur");
});

test("routes d’administration fermées sans session", async () => {
  await withApi({ isDatabaseReady: () => true }, async (origin) => {
    for (const [method, path] of [
      ["GET", "/dashboard"],
      ["GET", "/security"],
      ["GET", "/auth/sessions"],
      ["DELETE", "/auth/sessions"],
      ["POST", "/auth/password"],
      ["GET", "/resources/constructor"],
    ]) {
      const response = await fetch(`${origin}/api/admin${path}`, { method });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  });
});

test("administration indisponible sans MongoDB", async () => {
  await withApi({ isDatabaseReady: () => false }, async (origin) => {
    const response = await fetch(`${origin}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "x" }),
    });
    assert.equal(response.status, 503);
  });
});

test("import d’image : format lu dans les octets, SVG et HTML refusés", async () => {
  const { imageExtension } = await import("../controllers/upload.controller.js");
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(16)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  const webp = Buffer.from("RIFF\0\0\0\0WEBPVP8 ________");
  assert.equal(imageExtension(png), "png");
  assert.equal(imageExtension(jpg), "jpg");
  assert.equal(imageExtension(webp), "webp");
  assert.equal(imageExtension(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(imageExtension(Buffer.from("<html><script>alert(1)</script></html>")), null);
  assert.equal(imageExtension(Buffer.alloc(0)), null);
});

test("import d’image fermé sans session, fichiers servis sans exécution", async () => {
  await withApi({ isDatabaseReady: () => true }, async (origin) => {
    const upload = await fetch(`${origin}/api/admin/uploads`, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    assert.equal(upload.status, 401);
    // Requêtes brutes : fetch normaliserait « .. » avant l’envoi.
    for (const path of ["/uploads/../.env", "/uploads/..%2f.env", "/uploads/%2e%2e%2f.env", "/uploads/..%5c.env"])
      assert.equal(await rawStatus(origin, path), 404, path);
    const unknown = await fetch(`${origin}/uploads/absent.png`);
    assert.equal(unknown.status, 404);
  });
});
