import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import rateLimit from "express-rate-limit";
import { createApp } from "../app.js";
import { proxySetting, smtpOptions } from "../config/runtime.js";

test("proxy: production limitée à loopback, valeurs explicites respectées", () => {
  assert.equal(proxySetting({ NODE_ENV: "production" }), "loopback");
  assert.equal(proxySetting({}), false);
  assert.equal(proxySetting({ TRUST_PROXY: " false " }), false);
  assert.equal(proxySetting({ TRUST_PROXY: "0" }), false);
  assert.equal(proxySetting({ TRUST_PROXY: "1" }), 1);
  assert.equal(proxySetting({ TRUST_PROXY: "10.0.0.1" }), "10.0.0.1");
  assert.throws(() => proxySetting({ TRUST_PROXY: "true" }), /trop permissif/);
});

test("proxy local: IP réelle utilisée sans faire confiance à une IP ajoutée à gauche", async () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "loopback";
  let app;
  try { app = createApp(); }
  finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
  // Isolate the probe from the production SPA catch-all route.
  const probe = express();
  probe.set("trust proxy", app.get("trust proxy"));
  probe.use(rateLimit({ windowMs: 60000, limit: 5 }));
  probe.get("/proxy-test", (req, res) => res.json({ ip: req.ip, protocol: req.protocol }));
  const server = probe.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const result = await fetch(`http://127.0.0.1:${server.address().port}/proxy-test`, {
      headers: { "X-Forwarded-For": "198.51.100.99, 203.0.113.10", "X-Forwarded-Proto": "https" },
    });
    assert.deepEqual(await result.json(), { ip: "203.0.113.10", protocol: "https" });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

const base = { SMTP_HOST: "smtp.example.com", SMTP_FROM: "centre@example.com", SMTP_USER: "centre@example.com", SMTP_PASSWORD: " secret " };
test("SMTP: port 465 déduit TLS et préserve le mot de passe", () => {
  const options = smtpOptions({ ...base, SMTP_PORT: "465" });
  assert.equal(options.secure, true);
  assert.equal(options.auth.pass, " secret ");
});
test("SMTP: port 587 exige STARTTLS et rejette les couples TLS incohérents", () => {
  assert.equal(smtpOptions(base).requireTLS, true);
  assert.equal(smtpOptions(base).secure, false);
  assert.throws(() => smtpOptions({ ...base, SMTP_PORT: "465", SMTP_SECURE: "false" }), /incompatible/);
  assert.throws(() => smtpOptions({ ...base, SMTP_PORT: "587", SMTP_SECURE: "true" }), /incompatible/);
  assert.throws(() => smtpOptions({ ...base, SMTP_PORT: "oops" }), /port valide/);
  assert.throws(() => smtpOptions({ ...base, SMTP_SECURE: "yes" }), /true ou false/);
  assert.throws(() => smtpOptions({ ...base, SMTP_PASSWORD: "" }), /incomplet/);
});
