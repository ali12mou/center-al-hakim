// Les tests se connectent sans code e-mail (option ignorée en production).
process.env.ADMIN_OTP ??= "off";
// Espace student (application) : accès créés par l’administration, isolement
// des données entre students et séparation stricte avec l’administration.
// Base MongoDB de test créée puis supprimée (jamais la base du centre).
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { platformModels, AdminUser } from "../models/platform.models.js";
import { financeModels } from "../models/finance.models.js";
import { systemModels } from "../models/system.models.js";
import { studentModels } from "../models/student.models.js";
import { Course } from "../models/index.js";
import { hashPassword } from "../services/password.service.js";
import { seedFinance } from "../services/finance.service.js";
import { today } from "../services/dates.js";

const uri = `mongodb://127.0.0.1:27017/alhakim_student_test_${process.pid}`;
let available = true;
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
} catch {
  available = false;
}

// Client HTTP avec son propre cookie de session et son jeton CSRF.
function client(origin, base, cookieName) {
  let cookie = "";
  let csrf = "";
  const call = async (method, path, body, { noCsrf = false, rawCookie } = {}) => {
    const response = await fetch(`${origin}${base}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...((rawCookie ?? cookie) ? { Cookie: rawCookie ?? cookie } : {}),
        ...(csrf && !noCsrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith(`${cookieName}=`)) cookie = setCookie.split(";")[0];
    const data = response.headers.get("content-type")?.includes("json") ? await response.json() : null;
    if (data?.csrfToken) csrf = data.csrfToken;
    return { status: response.status, data, headers: response.headers };
  };
  return {
    call,
    get cookie() {
      return cookie;
    },
    login: (username, password) => call("POST", "/auth/login", { username, password }),
  };
}

test("espace student : accès, isolement et séparation de l’administration", { skip: !available && "MongoDB local indisponible" }, async (t) => {
  await Promise.all(
    [...platformModels, ...financeModels, ...systemModels, ...studentModels, Course].map((model) => model.init()),
  );
  await seedFinance();
  await Course.create([
    { id: "anglais", department: "langues", title: "Anglais général", description: "Cours" },
    { id: "excel", department: "informatique", title: "Excel", description: "Cours" },
  ]);
  const adminPassword = "Sable-Vent-Port-2026";
  await AdminUser.create({
    name: "Direction Test",
    username: "direction",
    email: "direction@example.com",
    passwordHash: await hashPassword(adminPassword),
    role: "admin",
  });
  const server = createApp({ isDatabaseReady: () => true }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const admin = client(origin, "/api/admin", "ah_admin");
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  assert.equal((await admin.login("direction", adminPassword)).status, 200);

  const dossier = async (studentName, phone, courseId) =>
    (
      await admin.call("POST", "/finance/student-accounts", {
        studentName,
        phone,
        courseId,
        baseAmount: 30000,
        plan: "monthly",
        count: 3,
        startDate: today(),
      })
    ).data.item;
  const amina = await dossier("Amina Ali", "77 11 22 33", "anglais");
  const omar = await dossier("Omar Said", "77 44 55 66", "excel");

  let aminaPassword;
  const student = client(origin, "/api/student", "ah_student");

  await t.test("l’administration crée l’accès avec un mot de passe provisoire", async () => {
    const created = await admin.call("POST", "/eleves/access", { accountIds: [amina._id] });
    assert.equal(created.status, 201);
    assert.equal(created.data.item.username, "77112233");
    assert.equal(created.data.item.name, "Amina Ali");
    assert.ok(created.data.temporaryPassword.length >= 12);
    assert.equal(created.data.item.passwordHash, undefined);
    // Un second accès pour le même dossier est refusé.
    assert.equal((await admin.call("POST", "/eleves/access", { accountIds: [amina._id] })).status, 409);
    const listed = await admin.call("GET", "/eleves/students");
    assert.equal(listed.data.items.find((item) => item.studentName === "Amina Ali").access.username, "77112233");
    assert.equal(listed.data.items.find((item) => item.studentName === "Omar Said").access, null);

    const login = await student.login("77112233", created.data.temporaryPassword);
    assert.equal(login.status, 200);
    assert.equal(login.data.user.mustChangePassword, true);
    assert.equal((await student.call("GET", "/me")).status, 403);
    aminaPassword = "Palmier-Dune-Lagon-88";
    const changed = await student.call("POST", "/auth/password", {
      currentPassword: created.data.temporaryPassword,
      newPassword: aminaPassword,
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.user.mustChangePassword, false);
  });

  await t.test("mauvais mot de passe refusé, CSRF exigé", async () => {
    const intruder = client(origin, "/api/student", "ah_student");
    assert.equal((await intruder.login("77112233", "Mauvais-Mot-2026")).status, 401);
    assert.equal((await intruder.call("GET", "/me")).status, 401);
    assert.equal((await student.call("POST", "/auth/logout", null, { noCsrf: true })).status, 403);
  });

  await t.test("le student ne voit que son dossier et sa formation", async () => {
    const me = await student.call("GET", "/me");
    assert.equal(me.status, 200);
    assert.equal(me.data.accounts.length, 1);
    assert.equal(me.data.accounts[0].courseTitle, "Anglais général");
    assert.equal(me.data.accounts[0].schedule.length, 3);
    assert.equal(me.data.accounts[0].balance, 30000);
    assert.equal(JSON.stringify(me.data).includes("Omar"), false);
  });

  await t.test("sessions student et administration totalement séparées", async () => {
    // Le cookie student n’ouvre pas l’administration…
    const asStudent = await admin.call("GET", "/dashboard", null, {
      rawCookie: student.cookie.replace("ah_student=", "ah_admin="),
    });
    assert.equal(asStudent.status, 401);
    assert.equal((await admin.call("GET", "/eleves/access", null, { rawCookie: student.cookie })).status, 401);
    // … et le cookie administrateur n’ouvre pas l’espace student.
    assert.equal((await student.call("GET", "/me", null, { rawCookie: admin.cookie })).status, 401);
    assert.equal(
      (await student.call("GET", "/me", null, { rawCookie: admin.cookie.replace("ah_admin=", "ah_student=") })).status,
      401,
    );
  });

  await t.test("cours, présences, notes et annonces filtrés par formation", async () => {
    const lesson = await admin.call("POST", "/eleves/lessons", {
      courseId: "anglais",
      title: "Unit 1 · Greetings",
      kind: "lesson",
      body: "Hello, how are you?",
    });
    assert.equal(lesson.status, 201);
    const other = await admin.call("POST", "/eleves/lessons", {
      courseId: "excel",
      title: "Formules",
      kind: "document",
      fileUrl: "/api/admin/files/00000000-0000-0000-0000-000000000000.pdf",
    });
    assert.equal(other.status, 201);
    await admin.call("POST", "/eleves/lessons", { courseId: "anglais", title: "Brouillon", published: false });
    assert.equal((await admin.call("POST", "/eleves/lessons", { courseId: "anglais", title: "Vidéo", kind: "video" })).status, 400);

    const lessons = await student.call("GET", "/lessons");
    assert.deepEqual(lessons.data.items.map((item) => item.title), ["Unit 1 · Greetings"]);
    assert.equal(lessons.data.items[0].fileUrl, undefined);
    assert.equal((await student.call("GET", `/lessons/${other.data.item._id}/file`)).status, 404);

    // Appel : Omar (autre formation) est ignoré même s’il est envoyé.
    const roll = await admin.call("POST", "/eleves/roll", {
      courseId: "anglais",
      date: today(),
      entries: [
        { studentAccountId: amina._id, status: "late", notes: "10 min" },
        { studentAccountId: omar._id, status: "absent" },
      ],
    });
    assert.equal(roll.data.saved, 1);
    const again = await admin.call("POST", "/eleves/roll", {
      courseId: "anglais",
      date: today(),
      entries: [{ studentAccountId: amina._id, status: "present" }],
    });
    assert.equal(again.data.saved, 1);

    const grades = await admin.call("POST", "/eleves/grades/batch", {
      courseId: "anglais",
      title: "Contrôle 1",
      date: today(),
      maxScore: 20,
      entries: [{ studentAccountId: amina._id, score: 15, comment: "Bien" }],
    });
    assert.equal(grades.data.saved, 1);
    await admin.call("POST", "/eleves/grades/batch", {
      courseId: "anglais",
      title: "Non publié",
      date: today(),
      published: false,
      entries: [{ studentAccountId: amina._id, score: 4 }],
    });
    assert.equal(
      (
        await admin.call("POST", "/eleves/grades/batch", {
          courseId: "anglais",
          title: "Trop haut",
          date: today(),
          maxScore: 10,
          entries: [{ studentAccountId: amina._id, score: 12 }],
        })
      ).status,
      400,
    );

    const progress = await student.call("GET", "/progress");
    assert.equal(progress.data.attendance.length, 1);
    assert.equal(progress.data.attendance[0].status, "present");
    assert.equal(progress.data.stats.rate, 100);
    assert.deepEqual(progress.data.grades.map((grade) => grade.title), ["Contrôle 1"]);
    assert.equal(progress.data.stats.average, 15);

    await admin.call("POST", "/eleves/announcements", { title: "Fermeture vendredi", date: today() });
    await admin.call("POST", "/eleves/announcements", { title: "Examen d’anglais", courseId: "anglais", date: today(), pinned: true });
    await admin.call("POST", "/eleves/announcements", { title: "Atelier Excel", courseId: "excel", date: today() });
    const news = await student.call("GET", "/announcements");
    assert.deepEqual(news.data.items.map((item) => item.title), ["Examen d’anglais", "Fermeture vendredi"]);
  });

  await t.test("droits : un compte limité aux cours ne gère pas les accès", async () => {
    const staff = await admin.call("POST", "/system/users", {
      name: "Formateur",
      username: "formateur",
      email: "formateur@example.com",
      role: "staff",
      permissions: ["eleves.lessons:create"],
    });
    const teacher = client(origin, "/api/admin", "ah_admin");
    await teacher.login("formateur", staff.data.temporaryPassword);
    await teacher.call("POST", "/auth/password", {
      currentPassword: staff.data.temporaryPassword,
      newPassword: "Baobab-Corail-Rive-41",
    });
    assert.equal((await teacher.call("GET", "/eleves/lessons")).status, 200);
    assert.equal((await teacher.call("POST", "/eleves/lessons", { courseId: "anglais", title: "Unit 2" })).status, 201);
    assert.equal((await teacher.call("GET", "/eleves/access")).status, 403);
    assert.equal((await teacher.call("POST", "/eleves/access", { accountIds: [omar._id] })).status, 403);
    assert.equal((await teacher.call("POST", "/eleves/roll", { courseId: "anglais", date: today(), entries: [] })).status, 403);
  });

  await t.test("réinitialisation et désactivation coupent la session du student", async () => {
    const { data } = await admin.call("GET", "/eleves/access");
    const access = data.items[0];
    const reset = await admin.call("POST", `/eleves/access/${access._id}/reset`);
    assert.equal(reset.status, 200);
    assert.equal((await student.call("GET", "/me")).status, 401);
    assert.equal((await student.login("77112233", aminaPassword)).status, 401);
    const relogin = await student.login("77112233", reset.data.temporaryPassword);
    assert.equal(relogin.data.user.mustChangePassword, true);

    assert.equal((await admin.call("PATCH", `/eleves/access/${access._id}`, { active: false })).status, 200);
    assert.equal((await student.call("GET", "/auth/status")).data.user, null);
    assert.equal((await student.login("77112233", reset.data.temporaryPassword)).status, 403);
  });
});
