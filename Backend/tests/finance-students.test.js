// Les tests se connectent sans code e-mail (option ignorée en production).
process.env.ADMIN_OTP ??= "off";
// Finances › Frais des formations, Liste des students, Encaissements, et
// compteurs « payé / non payé » — sur une base MongoDB de test jetable.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { platformModels, AdminUser } from "../models/platform.models.js";
import { financeModels } from "../models/finance.models.js";
import { systemModels } from "../models/system.models.js";
import { Course } from "../models/index.js";
import { hashPassword } from "../services/password.service.js";
import { seedFinance } from "../services/finance.service.js";

const uri = `mongodb://127.0.0.1:27017/alhakim_test_fs_${process.pid}`;
let available = true;
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
} catch {
  available = false;
}

test("frais, students et encaissements", { skip: !available && "MongoDB local indisponible" }, async (t) => {
  await Promise.all([...platformModels, ...financeModels, ...systemModels, Course].map((model) => model.init()));
  await seedFinance();
  await Course.create({ id: "anglais", department: "langues", title: "Anglais général", description: "Cours" });
  await AdminUser.create({
    name: "Direction Test",
    username: "direction",
    email: "direction@example.com",
    passwordHash: await hashPassword("Sable-Vent-Port-2026"),
    role: "admin",
  });
  const server = createApp({ isDatabaseReady: () => true }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  let csrf = "";
  const call = async (method, path, body) => {
    const response = await fetch(`${origin}/api/admin${path}`, {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith("ah_admin=")) cookie = setCookie.split(";")[0];
    const data = await response.json();
    if (data.csrfToken) csrf = data.csrfToken;
    return { status: response.status, data };
  };
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  assert.equal((await call("POST", "/auth/login", { username: "direction", password: "Sable-Vent-Port-2026" })).status, 200);

  // Frais mensuel : 10 000 par mois sur 3 mois.
  const fee = await call("POST", "/finance/fees", {
    courseId: "anglais",
    feeType: "monthly",
    amount: 10000,
    durationMonths: 3,
    schoolYear: "2025-2026",
  });
  assert.equal(fee.status, 201, JSON.stringify(fee.data));
  assert.equal(fee.data.item.feeType, "monthly");
  assert.equal((await call("POST", "/finance/fees", { courseId: "anglais", label: "X", amount: 1, schoolYear: "2025-2027" })).status, 400);

  // Deux students : ID automatique, nom d’utilisateur unique, mot de passe jamais renvoyé.
  const amina = await call("POST", "/finance/students", {
    name: "Amina Ali",
    courseId: "anglais",
    phone: "+253 77 11 22 33",
    username: "amina.ali",
    password: "Bonjour-2026",
  });
  assert.equal(amina.status, 201, JSON.stringify(amina.data));
  assert.match(amina.data.item.reference, /^ELV-\d{4}-\d{4}$/);
  assert.equal(amina.data.item.hasPassword, true);
  assert.equal(amina.data.item.passwordHash, undefined);
  assert.equal(amina.data.item.paymentStatus, "unpaid");
  const omar = await call("POST", "/finance/students", { name: "Omar Said", courseId: "anglais", phone: "77445566" });
  assert.equal(omar.status, 201);
  assert.equal(
    (await call("POST", "/finance/students", { name: "Autre", courseId: "anglais", phone: "77000000", username: "AMINA.ALI" })).status,
    409,
  );

  // Une demande du site (Inscrits) n’apparaît pas dans la liste des students…
  const { Registration } = await import("../models/platform.models.js");
  const inscrit = await Registration.create({
    reference: "AH-ABCDEF123456",
    name: "Fatouma Hassan",
    email: "fatouma@example.com",
    phone: "77998877",
    courseId: "anglais",
  });
  assert.equal((await call("GET", "/finance/students")).data.items.length, 2);
  const candidates = await call("GET", "/lookups/registrations?student=0");
  assert.deepEqual(candidates.data.items.map((item) => item.name), ["Fatouma Hassan"]);
  // … jusqu’à ce qu’on la choisisse dans « Nouveau student » : même fiche, même ID, complétée.
  const fatouma = await call("POST", "/finance/students", {
    registrationId: String(inscrit._id),
    name: "Fatouma Hassan",
    courseId: "anglais",
    phone: "77998877",
    username: "fatouma.h",
  });
  assert.equal(fatouma.status, 201, JSON.stringify(fatouma.data));
  assert.equal(fatouma.data.item._id, String(inscrit._id));
  assert.equal(fatouma.data.item.reference, "AH-ABCDEF123456");
  assert.equal(fatouma.data.item.username, "fatouma.h");
  assert.equal(await Registration.countDocuments(), 3, "aucun doublon");
  assert.equal((await call("POST", "/finance/students", { registrationId: String(inscrit._id), name: "Fatouma bis", courseId: "anglais", phone: "77000001" })).status, 409);
  assert.equal((await call("GET", "/lookups/registrations?student=0")).data.items.length, 0);

  // Students de la formation pour le formulaire d’encaissement.
  const lookup = await call("GET", "/lookups/registrations?courseId=anglais&student=1");
  assert.equal(lookup.data.items.length, 3);
  // Retirer de la liste : la fiche reste dans les Inscrits.
  assert.equal((await call("DELETE", `/finance/students/${fatouma.data.item._id}`)).status, 200);
  assert.equal(await Registration.countDocuments(), 3);

  // Encaissement : ouvre le dossier (3 × 10 000) puis enregistre le paiement en espèces.
  const paid = await call("POST", "/finance/collections", {
    courseId: "anglais",
    registrationId: amina.data.item._id,
    feeId: fee.data.item._id,
    amount: 10000,
    method: "cash",
    notes: "Mensualité 1",
  });
  assert.equal(paid.status, 201, JSON.stringify(paid.data));
  assert.equal(paid.data.item.amount, 10000);
  assert.equal(
    (await call("POST", "/finance/collections", { courseId: "anglais", registrationId: amina.data.item._id, amount: 25000, method: "cash" })).status,
    400,
    "le montant ne peut pas dépasser le reste dû (20 000)",
  );

  const collections = await call("GET", "/finance/collections");
  assert.equal(collections.data.items.length, 1);
  const row = collections.data.items[0];
  assert.equal(row.studentCode, amina.data.item.reference);
  assert.equal(row.feeLabel, "Frais mensuel – Anglais général", "nom du frais calculé par le serveur");
  assert.equal(row.courseTitle, "Anglais général");
  assert.equal(row.method, "cash");

  // Situation de paiement : Amina a payé en partie, Omar rien.
  const students = await call("GET", "/finance/students");
  const byName = Object.fromEntries(students.data.items.map((item) => [item.name, item]));
  assert.equal(byName["Amina Ali"].paymentStatus, "partial");
  assert.equal(byName["Amina Ali"].due, 30000);
  assert.equal(byName["Omar Said"].paymentStatus, "unpaid");
  assert.equal((await call("GET", "/finance/students?payment=unpaid")).data.items.length, 1);

  const dashboard = await call("GET", "/finance/dashboard?from=2020-01-01&to=2099-12-31");
  assert.deepEqual(dashboard.data.students, { total: 2, paid: 1, unpaid: 1, upToDate: 0 });

  // Un student qui a un dossier financier ne se supprime pas.
  assert.equal((await call("DELETE", `/finance/students/${amina.data.item._id}`)).status, 409);
  assert.equal((await call("DELETE", `/finance/students/${omar.data.item._id}`)).status, 200);
});
