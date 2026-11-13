// Mot de passe oublié : e-mail → code à 6 chiffres → nouveau mot de passe,
// sur une base MongoDB de test jetable. Sans SMTP, le code est lu dans la console.
process.env.ADMIN_OTP ??= "off";
delete process.env.SMTP_HOST;
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { platformModels, AdminUser, AdminSession } from "../models/platform.models.js";
import { hashPassword, verifyPassword } from "../services/password.service.js";

const uri = `mongodb://127.0.0.1:27017/alhakim_test_fp_${process.pid}`;
let available = true;
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
} catch {
  available = false;
}

test("mot de passe oublié par code e-mail", { skip: !available && "MongoDB local indisponible" }, async (t) => {
  await Promise.all(platformModels.map((model) => model.init()));
  const user = await AdminUser.create({
    name: "Direction Test",
    username: "direction",
    email: "direction@example.com",
    passwordHash: await hashPassword("Sable-Vent-Port-2026"),
    role: "admin",
  });
  await AdminSession.create({
    userId: user._id,
    tokenHash: "x".repeat(64),
    csrfToken: "y",
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  const server = createApp({ isDatabaseReady: () => true }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body) => {
    const response = await fetch(`${origin}/api/admin${path}`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  // Le code envoyé « par la console » (pas de SMTP en test).
  let lastCode = "";
  const warn = console.warn;
  console.warn = (message, ...rest) => {
    const match = /\[OTP\].*: (\d{6})/.exec(String(message));
    if (match) lastCode = match[1];
    else warn(message, ...rest);
  };
  t.after(async () => {
    console.warn = warn;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  // Adresse inconnue : même réponse, aucun code envoyé.
  const unknown = await call("/auth/forgot", { email: "personne@example.com" });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.otpRequired, true);
  assert.equal(lastCode, "");
  assert.equal(
    (await call("/auth/forgot/verify", { challenge: unknown.data.challenge, code: "123456" })).data.otpExpired,
    true,
  );

  const sent = await call("/auth/forgot", { email: "Direction@Example.com" });
  assert.equal(sent.status, 200);
  assert.match(sent.data.email, /^di•+@example\.com$/);
  assert.match(lastCode, /^\d{6}$/);
  const { challenge } = sent.data;

  // Un code de réinitialisation n’ouvre pas de session de connexion.
  assert.equal((await call("/auth/otp", { challenge, code: lastCode })).data.otpExpired, true);
  // Le nouveau mot de passe exige le code vérifié.
  assert.equal(
    (await call("/auth/forgot/reset", { challenge, newPassword: "Nuage-Corail-Baie-31" })).data.otpExpired,
    true,
  );
  const wrong = String((Number(lastCode) + 1) % 1_000_000).padStart(6, "0");
  assert.match((await call("/auth/forgot/verify", { challenge, code: wrong })).data.error, /4 essais/);

  const verified = await call("/auth/forgot/verify", { challenge, code: lastCode });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.username, "direction");
  // Le code ne sert qu’une fois.
  assert.equal((await call("/auth/forgot/verify", { challenge, code: lastCode })).status, 400);

  // Politique de mot de passe appliquée.
  assert.match((await call("/auth/forgot/reset", { challenge, newPassword: "court" })).data.error, /12 caractères/);
  assert.match(
    (await call("/auth/forgot/reset", { challenge, newPassword: "Sable-Vent-Port-2026" })).data.error,
    /différent/,
  );
  const reset = await call("/auth/forgot/reset", { challenge, newPassword: "Nuage-Corail-Baie-31" });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.username, "direction");

  const saved = await AdminUser.findById(user._id).select("+passwordHash");
  assert.equal(await verifyPassword("Nuage-Corail-Baie-31", saved.passwordHash), true);
  assert.equal(await AdminSession.countDocuments({ userId: user._id }), 0);
  // Le défi est consommé.
  assert.equal(
    (await call("/auth/forgot/reset", { challenge, newPassword: "Autre-Corail-Baie-32" })).data.otpExpired,
    true,
  );
  // Connexion avec le nouveau mot de passe.
  assert.equal(
    (await call("/auth/login", { username: "direction", password: "Nuage-Corail-Baie-31" })).status,
    200,
  );
});
