// Marketing et prospection : agents, portail /api/marketing, prospects,
// historique des statuts et liaison aux inscrits — base MongoDB jetable.
process.env.ADMIN_OTP ??= "off";
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { platformModels, AdminUser, Registration } from "../models/platform.models.js";
import { systemModels } from "../models/system.models.js";
import { marketingModels, MarketingAgent } from "../models/marketing.models.js";
import { Course } from "../models/index.js";
import { hashPassword } from "../services/password.service.js";

const uri = `mongodb://127.0.0.1:27017/alhakim_test_mk_${process.pid}`;
let available = true;
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
} catch {
  available = false;
}

// Client HTTP avec cookie et jeton CSRF propres.
function client(origin, base) {
  let cookie = "";
  let csrf = "";
  return async (method, path, body) => {
    const response = await fetch(`${origin}${base}${path}`, {
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
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await response.json();
    if (data.csrfToken) csrf = data.csrfToken;
    return { status: response.status, data };
  };
}

test("agents marketing et collecte des prospects", { skip: !available && "MongoDB local indisponible" }, async (t) => {
  await Promise.all([...platformModels, ...systemModels, ...marketingModels, Course].map((model) => model.init()));
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
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const admin = client(origin, "/api/admin");
  assert.equal((await admin("POST", "/auth/login", { username: "direction", password: "Sable-Vent-Port-2026" })).status, 200);

  // Création d’agents : mot de passe saisi, ou provisoire généré.
  const weak = await admin("POST", "/marketing/agents", { name: "Agent 01", email: "a1@example.com", password: "court" });
  assert.equal(weak.status, 400);
  const a1 = await admin("POST", "/marketing/agents", {
    name: "Agent 01",
    phone: "77 11 22 33",
    email: "A1@example.com",
    password: "Marche-Terrain-2026",
  });
  assert.equal(a1.status, 201);
  assert.match(a1.data.item.reference, /^AGT-\d{4}-0001$/);
  assert.equal(a1.data.temporaryPassword, undefined);
  const a2 = await admin("POST", "/marketing/agents", { name: "Agent 02", email: "a2@example.com" });
  assert.match(a2.data.temporaryPassword, /\S{12,}/);
  assert.equal((await admin("POST", "/marketing/agents", { name: "Doublon", email: "a1@example.com" })).status, 409);
  const stored = await MarketingAgent.findById(a1.data.item._id).select("+passwordHash").lean();
  assert.notEqual(stored.passwordHash, "Marche-Terrain-2026");

  // Portail : connexion par e-mail, mot de passe personnel exigé d’abord.
  const agent1 = client(origin, "/api/marketing");
  assert.equal((await agent1("POST", "/auth/login", { email: "a1@example.com", password: "mauvais" })).status, 401);
  const login = await agent1("POST", "/auth/login", { email: "a1@example.com", password: "Marche-Terrain-2026" });
  assert.equal(login.data.user.mustChangePassword, true);
  assert.equal((await agent1("GET", "/prospects")).data.passwordChangeRequired, true);
  assert.equal(
    (await agent1("POST", "/auth/password", { currentPassword: "Marche-Terrain-2026", newPassword: "Prospect-Djib-4521" })).status,
    200,
  );
  // La session marketing n’ouvre pas l’administration.
  assert.equal((await agent1("GET", "/../admin/dashboard")).status, 401);
  assert.equal((await agent1("GET", "/courses")).data.items[0].id, "anglais");

  const p1 = await agent1("POST", "/prospects", {
    name: "Prospect A",
    phone: "+253 77 55 66 77",
    email: "pa@example.com",
    courseId: "anglais",
    source: "field",
    consent: true,
  });
  assert.equal(p1.status, 201);
  assert.equal(p1.data.item.agentName, "Agent 01");
  assert.equal(p1.data.item.status, "new");
  assert.match(p1.data.item.reference, /^PRO-\d{4}-0001$/);
  // Doublon par téléphone (autre écriture), sans révéler l’autre fiche à l’agent.
  const dup = await agent1("POST", "/prospects", { name: "Autre", phone: "77556677", courseId: "anglais" });
  assert.equal(dup.status, 409);
  assert.doesNotMatch(dup.data.error, /Prospect A/);
  assert.equal((await agent1("POST", "/prospects", { name: "Sans formation", phone: "77000001", courseId: "inconnue" })).status, 400);

  // Changement de statut historisé.
  const id = p1.data.item._id;
  const changed = await agent1("POST", `/prospects/${id}/status`, { status: "interested", note: "Rappeler lundi", nextFollowUp: "2020-01-06" });
  assert.equal(changed.data.item.status, "interested");
  const history = await agent1("GET", `/prospects/${id}/history`);
  assert.equal(history.data.items.length, 2);
  assert.equal(history.data.items[0].from, "new");
  assert.equal(history.data.items[0].by.name, "Agent 01");
  const mineStats = await agent1("GET", "/stats");
  assert.equal(mineStats.data.total, 1);
  assert.equal(mineStats.data.interested, 1);
  assert.equal(mineStats.data.followUps, 1);

  // Un autre agent ne voit pas les prospects du premier.
  await admin("POST", `/marketing/agents/${a2.data.item._id}/password`, { password: "Collecte-Ville-8812" });
  const agent2 = client(origin, "/api/marketing");
  await agent2("POST", "/auth/login", { email: "a2@example.com", password: "Collecte-Ville-8812" });
  await agent2("POST", "/auth/password", { currentPassword: "Collecte-Ville-8812", newPassword: "Agent-Deux-Terrain-77" });
  assert.equal((await agent2("GET", "/prospects")).data.total, 0);
  assert.equal((await agent2("GET", `/prospects/${id}/history`)).status, 404);
  assert.equal((await agent2("POST", `/prospects/${id}/status`, { status: "enrolled" })).status, 404);

  // Administration : liste complète, statistiques par agent, liaison à l’inscrit.
  const list = await admin("GET", "/marketing/prospects?status=interested");
  assert.equal(list.data.total, 1);
  const registration = await Registration.create({
    reference: "AH-TEST00000001",
    name: "Prospect A",
    phone: "77-55-66-77",
    courseId: "anglais",
  });
  const enrolled = await admin("POST", `/marketing/prospects/${id}/status`, { status: "enrolled" });
  assert.equal(enrolled.data.item.registrationReference, registration.reference);
  const stats = await admin("GET", "/marketing/stats");
  assert.equal(stats.data.enrolled, 1);
  assert.equal(stats.data.conversion, 100);
  assert.equal(stats.data.byAgent[0].name, "Agent 01");
  const agents = await admin("GET", "/marketing/agents");
  assert.equal(agents.data.items.find((item) => item.email === "a1@example.com").prospects, 1);

  // Prospect sans inscrit : création de l’inscrit à partir de la fiche.
  const p2 = await admin("POST", "/marketing/prospects", { name: "Prospect B", phone: "77 88 99 00", courseId: "anglais" });
  const linked = await admin("POST", `/marketing/prospects/${p2.data.item._id}/link`, { create: true });
  assert.match(linked.data.item.registrationReference, /^AH-/);
  assert.equal(await Registration.countDocuments(), 2);

  // Agent avec prospects : suppression refusée ; désactivation = déconnexion.
  assert.equal((await admin("DELETE", `/marketing/agents/${a1.data.item._id}`)).status, 409);
  await admin("PATCH", `/marketing/agents/${a1.data.item._id}`, { active: false });
  assert.equal((await agent1("GET", "/prospects")).status, 401);
  const activity = await admin("GET", `/marketing/agents/${a1.data.item._id}/activity`);
  assert.ok(activity.data.items.some((item) => item.action === "prospect_created"));
});
