// Les tests se connectent sans code e-mail (option ignorée en production).
process.env.ADMIN_OTP ??= "off";
// Parcours complets RH, finances et droits d’accès, sur une base MongoDB de
// test créée puis supprimée (jamais la base du centre). Ignoré sans MongoDB.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import mongoose from "mongoose";
import { createApp } from "../app.js";
import { platformModels, AdminUser } from "../models/platform.models.js";
import { hrModels } from "../models/hr.models.js";
import { financeModels } from "../models/finance.models.js";
import { systemModels } from "../models/system.models.js";
import { Course } from "../models/index.js";
import { hashPassword } from "../services/password.service.js";
import { seedFinance } from "../services/finance.service.js";
import { currentMonth, monthDays, weekday } from "../services/dates.js";

const uri = `mongodb://127.0.0.1:27017/alhakim_test_${process.pid}`;
let available = true;
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 1500 });
} catch {
  available = false;
}

function client(origin) {
  let cookie = "";
  let csrf = "";
  const call = async (method, path, body) => {
    const response = await fetch(`${origin}/api/admin${path}`, {
      method,
      headers: {
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
  return {
    call,
    login: (username, password) => call("POST", "/auth/login", { username, password }),
  };
}

test("modules RH, finances et permissions (base de test)", { skip: !available && "MongoDB local indisponible" }, async (t) => {
  await Promise.all([...platformModels, ...hrModels, ...financeModels, ...systemModels, Course].map((model) => model.init()));
  await seedFinance();
  await Course.create({ id: "anglais", department: "langues", title: "Anglais général", description: "Cours" });
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
  const admin = client(origin);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  assert.equal((await admin.login("direction", adminPassword)).status, 200);

  await t.test("l’administrateur général crée un compte limité aux enseignants", async () => {
    const created = await admin.call("POST", "/system/users", {
      name: "Assistante RH",
      username: "assistante",
      email: "rh@example.com",
      role: "staff",
      permissions: ["rh.teachers:view", "finance.expenses:create", "inconnu:view"],
    });
    assert.equal(created.status, 201);
    assert.deepEqual(created.data.item.permissions, [
      "finance.expenses:create",
      "finance.expenses:view",
      "rh.teachers:view",
    ]);
    const staff = client(origin);
    const login = await staff.login("assistante", created.data.temporaryPassword);
    assert.equal(login.data.user.mustChangePassword, true);
    assert.equal((await staff.call("GET", "/rh/staff?kind=teacher")).status, 403);
    const changed = await staff.call("POST", "/auth/password", {
      currentPassword: created.data.temporaryPassword,
      newPassword: "Palmier-Dune-Lagon-88",
    });
    assert.equal(changed.status, 200);
    assert.equal((await staff.call("GET", "/rh/staff?kind=teacher")).status, 200);
    assert.equal((await staff.call("GET", "/rh/staff?kind=employee")).status, 403);
    assert.equal((await staff.call("POST", "/rh/staff", { kind: "teacher", firstName: "A", lastName: "B" })).status, 403);
    assert.equal((await staff.call("GET", "/finance/dashboard")).status, 403);
    assert.equal((await staff.call("GET", "/system/users")).status, 403);
    assert.equal((await staff.call("GET", "/resources/registrations")).status, 403);
    assert.deepEqual(Object.keys((await staff.call("GET", "/badges")).data), []);

    // Au-dessus du seuil, la dépense d’un non-validateur attend la direction.
    const { data: accounts } = await admin.call("GET", "/lookups/accounts");
    const cash = accounts.items.find((item) => item.kind === "cash");
    const categories = await admin.call("GET", "/finance/expense-categories");
    const expense = await staff.call("POST", "/finance/expenses", {
      date: `${currentMonth()}-02`,
      beneficiary: "Librairie",
      amount: 80000,
      categoryId: categories.data.items[0]._id,
      accountId: cash._id,
    });
    assert.equal(expense.status, 201);
    assert.equal(expense.data.item.status, "pending");
    assert.equal(expense.data.item.method, "cash");
    const decision = await admin.call("POST", `/finance/expenses/${expense.data.item._id}/decision`, { status: "validated" });
    assert.equal(decision.data.item.status, "validated");

    const disabled = await admin.call("PATCH", `/system/users/${created.data.item.id}`, { active: false });
    assert.equal(disabled.data.item.active, false);
    assert.equal((await staff.call("GET", "/rh/staff?kind=teacher")).status, 401);
  });

  await t.test("l’administrateur général ne peut pas se retirer ses droits", async () => {
    const { data } = await admin.call("GET", "/system/users");
    const me = data.items.find((user) => user.username === "direction");
    assert.equal((await admin.call("PATCH", `/system/users/${me.id}`, { role: "staff" })).status, 409);
    assert.equal((await admin.call("DELETE", `/system/users/${me.id}`)).status, 409);
  });

  await t.test("enseignant : planning → présences → paie → paiement validé puis versé", async () => {
    const month = currentMonth();
    const teacher = await admin.call("POST", "/rh/staff", {
      kind: "teacher",
      firstName: "Amina",
      lastName: "Hassan",
      payType: "hourly",
      hourlyRate: 2000,
      subjects: ["Anglais"],
    });
    assert.equal(teacher.status, 201);
    assert.match(teacher.data.item.reference, /^ENS-\d{4}-0001$/);
    const staffId = teacher.data.item._id;
    const days = monthDays(month);
    const firstDay = days[0];
    const assignment = await admin.call("POST", "/rh/assignments", {
      staffId,
      label: "Anglais A1",
      courseId: "anglais",
      weekdays: [weekday(firstDay)],
      startTime: "08:00",
      endTime: "10:00",
      startDate: firstDay,
    });
    assert.equal(assignment.status, 201);
    const generated = await admin.call("POST", "/rh/planning/generate", { month });
    const sessions = days.filter((date) => weekday(date) === weekday(firstDay)).length;
    assert.equal(generated.data.created, sessions);
    assert.equal((await admin.call("POST", "/rh/planning/generate", { month })).data.created, 0);

    const prepared = await admin.call("POST", "/rh/attendance/from-planning", { date: firstDay });
    assert.equal(prepared.data.created, 1);
    const extra = await admin.call("POST", "/rh/attendance", {
      staffId,
      date: days[1],
      startTime: "14:00",
      endTime: "16:00",
      classLabel: "Rattrapage",
    });
    assert.equal(extra.data.item.hours, 2);
    const list = await admin.call("GET", `/rh/attendance?staffId=${staffId}`);
    assert.equal(list.data.total, 2);
    const ids = list.data.items.map((item) => item._id);
    assert.equal((await admin.call("POST", "/rh/attendance/validate", { ids })).data.updated, 2);

    const payroll = await admin.call("POST", "/rh/payroll/calculate", { period: month });
    assert.equal(payroll.data.calculated, 1);
    const slips = await admin.call("GET", `/rh/payslips?period=${month}`);
    const slip = slips.data.items[0];
    assert.equal(slip.hours, 4);
    assert.equal(slip.net, 8000);
    assert.equal((await admin.call("POST", "/finance/staff-payments", {
      payslipId: slip._id, amount: 8000, date: firstDay, accountId: (await admin.call("GET", "/lookups/accounts")).data.items[0]._id,
    })).status, 409, "un bulletin brouillon ne se paie pas");
    assert.equal((await admin.call("POST", `/rh/payslips/${slip._id}/validate`)).data.item.status, "validated");

    const { data: accounts } = await admin.call("GET", "/lookups/accounts");
    const dmoney = accounts.items.find((item) => item.kind === "dmoney");
    const payment = await admin.call("POST", "/finance/staff-payments", {
      payslipId: slip._id,
      amount: 8000,
      date: firstDay,
      accountId: dmoney._id,
    });
    assert.equal(payment.data.item.status, "pending");
    const id = payment.data.item._id;
    assert.equal((await admin.call("POST", `/finance/staff-payments/${id}/pay`)).status, 409);
    assert.equal((await admin.call("POST", `/finance/staff-payments/${id}/approve`)).data.item.status, "approved");
    assert.equal((await admin.call("POST", `/finance/staff-payments/${id}/pay`)).data.item.status, "paid");
    const after = await admin.call("GET", `/rh/payslips/${slip._id}`);
    assert.equal(after.data.item.status, "paid");
    const balances = await admin.call("GET", "/finance/accounts/balances");
    assert.equal(balances.data.items.find((item) => item.kind === "dmoney").balance, -8000);
  });

  await t.test("student : échéancier sur 3 mois, paiement réparti, reçu, annulation", async () => {
    const fee = await admin.call("POST", "/finance/fees", {
      courseId: "anglais",
      label: "Anglais général — 3 mois",
      amount: 90000,
      registrationFee: 5000,
      durationMonths: 3,
    });
    const discount = await admin.call("POST", "/finance/discounts", { name: "Fratrie", kind: "percent", value: 10 });
    assert.equal((await admin.call("POST", "/finance/discounts", { name: "Erreur", kind: "percent", value: 150 })).status, 400);
    const account = await admin.call("POST", "/finance/student-accounts", {
      studentName: "Ali Omar",
      phone: "+253 77 00 00 00",
      feeId: fee.data.item._id,
      discountId: discount.data.item._id,
      plan: "installments",
      count: 3,
      startDate: "2026-01-10",
    });
    assert.equal(account.status, 201, JSON.stringify(account.data));
    const file = account.data.item;
    // 90 000 + 5 000 − 9 000 (10 % de la formation) = 86 000.
    assert.equal(file.totalAmount, 86000);
    assert.equal(file.installments.length, 3);
    assert.equal(file.courseTitle, "Anglais général");
    const { data: accounts } = await admin.call("GET", "/lookups/accounts");
    const cash = accounts.items.find((item) => item.kind === "cash");
    const waafi = accounts.items.find((item) => item.kind === "waafi");
    const invoice = await admin.call("POST", "/finance/invoices", { studentAccountId: file._id, issueDate: "2026-01-10" });
    assert.equal(invoice.data.item.total, 86000);
    const tooMuch = await admin.call("POST", "/finance/payments", {
      studentAccountId: file._id,
      date: "2026-01-10",
      splits: [{ accountId: cash._id, amount: 100000 }],
    });
    assert.equal(tooMuch.status, 400);
    const paid = await admin.call("POST", "/finance/payments", {
      studentAccountId: file._id,
      date: "2026-01-10",
      splits: [
        { accountId: cash._id, amount: 20000 },
        { accountId: waafi._id, amount: 10000, transactionRef: "WF-123" },
      ],
    });
    assert.equal(paid.status, 201);
    assert.equal(paid.data.item.amount, 30000);
    assert.match(paid.data.item.receiptNumber, /^REC-/);
    assert.equal(String(paid.data.item.invoiceId), invoice.data.item._id);
    const detail = await admin.call("GET", `/finance/student-accounts/${file._id}`);
    assert.equal(detail.data.item.paidAmount, 30000);
    assert.equal(detail.data.item.balance, 56000);
    const invoices = await admin.call("GET", `/finance/invoices?studentAccountId=${file._id}`);
    assert.equal(invoices.data.items[0].paymentStatus === "partial" || invoices.data.items[0].paymentStatus === "overdue", true);
    const receivables = await admin.call("GET", "/finance/receivables?status=overdue");
    assert.equal(receivables.data.items.length, 1);
    assert.equal((await admin.call("POST", `/finance/payments/${paid.data.item._id}/cancel`, {})).status, 400);
    const cancelled = await admin.call("POST", `/finance/payments/${paid.data.item._id}/cancel`, { reason: "Erreur de saisie" });
    assert.equal(cancelled.data.item.status, "cancelled");
    const reloaded = await admin.call("GET", `/finance/student-accounts/${file._id}`);
    assert.equal(reloaded.data.item.paidAmount, 0);
    assert.ok(reloaded.data.item.history.some((entry) => entry.action.includes("annulé")));
    const transfer = await admin.call("POST", "/finance/transfers", {
      date: "2026-01-11",
      fromAccountId: cash._id,
      toAccountId: waafi._id,
      amount: 999999999,
    });
    assert.equal(transfer.status, 409);
  });

  await t.test("avance : accordée par les RH, versée par les finances, retenue sur 2 mois", async () => {
    const employee = await admin.call("POST", "/rh/staff", {
      kind: "employee",
      firstName: "Moussa",
      lastName: "Ali",
      payType: "monthly",
      monthlySalary: 100000,
    });
    const staffId = employee.data.item._id;
    const advance = await admin.call("POST", "/finance/advances", {
      staffId,
      amount: 40000,
      period: "2030-01",
      repaymentMonths: 2,
      repaymentStart: "2030-02",
    });
    const id = advance.data.item._id;
    const { data: accounts } = await admin.call("GET", "/lookups/accounts");
    const cash = accounts.items.find((item) => item.kind === "cash");
    const disburse = { date: "2030-01-05", accountId: cash._id };
    assert.equal((await admin.call("POST", `/finance/advances/${id}/disburse`, disburse)).status, 409);
    await admin.call("POST", `/rh/adjustments/${id}/decision`, { status: "approved" });
    assert.equal((await admin.call("POST", `/finance/advances/${id}/disburse`, disburse)).status, 200);
    await admin.call("POST", "/rh/payroll/calculate", { period: "2030-02", staffIds: [staffId] });
    const february = (await admin.call("GET", `/rh/payslips?period=2030-02&staffId=${staffId}`)).data.items[0];
    assert.equal(february.net, 80000);
    await admin.call("POST", `/rh/payslips/${february._id}/validate`);
    await admin.call("POST", "/rh/payroll/calculate", { period: "2030-03", staffIds: [staffId] });
    const march = (await admin.call("GET", `/rh/payslips?period=2030-03&staffId=${staffId}`)).data.items[0];
    assert.equal(march.net, 80000);
    await admin.call("POST", `/rh/payslips/${march._id}/validate`);
    const advances = await admin.call("GET", "/finance/advances");
    assert.equal(advances.data.items.find((item) => item._id === id).remaining, 0);
  });

  await t.test("sécurité : journal des connexions, des comptes et des appels API", async () => {
    const overview = await admin.call("GET", "/system/security/overview");
    assert.equal(overview.status, 200);
    assert.ok(overview.data.calls24h > 10);
    const events = await admin.call("GET", "/system/security/events?event=user_created");
    assert.equal(events.data.items[0].target, "assistante");
    const api = await admin.call("GET", "/system/security/api?status=denied");
    assert.ok(api.data.items.some((item) => item.username === "assistante" && item.status === 403));
    const reports = await admin.call("GET", "/system/reports");
    assert.equal(reports.status, 200);
    assert.equal(reports.data.staff.teachers, 1);
  });
});
