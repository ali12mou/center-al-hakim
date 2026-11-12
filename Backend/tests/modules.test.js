import test from "node:test";
import assert from "node:assert/strict";
import { can, canModule, cleanPermissions } from "../config/permissions.js";
import {
  advanceInstallment,
  computePayslip,
  leaveDates,
  planMonth,
} from "../services/hr.service.js";
import {
  allocate,
  buildInstallments,
  discountValue,
  invoiceStatus,
  summarize,
} from "../services/finance.service.js";
import { addMonthsToDay, hoursBetween, monthDays, weekday } from "../services/dates.js";

test("permissions : l’administrateur général a tout, un utilisateur seulement ses cases", () => {
  const admin = { role: "admin" };
  const rh = { role: "staff", permissions: ["rh.teachers:view", "rh.teachers:create"] };
  assert.equal(can(admin, "finance.expenses", "approve"), true);
  assert.equal(can(rh, "rh.teachers", "create"), true);
  assert.equal(can(rh, "rh.teachers", "delete"), false);
  assert.equal(can(rh, "finance.payments"), false);
  assert.equal(can({ ...rh, active: false }, "rh.teachers"), false);
  assert.equal(canModule(rh, "rh"), true);
  assert.equal(canModule(rh, "finance"), false);
});

test("permissions : nettoyage (inconnues retirées, « consulter » ajouté)", () => {
  assert.deepEqual(
    cleanPermissions([
      "rh.leaves:approve",
      "rh.dashboard:delete",
      "inconnu:view",
      "constructor:view",
      42,
    ]),
    ["rh.leaves:approve", "rh.leaves:view"],
  );
});

test("dates : jours du mois, jour de la semaine, heures, mois suivant", () => {
  assert.equal(monthDays("2026-02").length, 28);
  assert.equal(weekday("2026-10-30"), 5);
  assert.equal(hoursBetween("08:00", "10:30"), 2.5);
  assert.equal(hoursBetween("22:00", "01:00"), 3);
  assert.equal(addMonthsToDay("2026-01-31", 1), "2026-02-28");
});

test("planning : séances générées par jour de la semaine, congés sautés", () => {
  const assignment = {
    _id: "a1",
    staffId: "s1",
    weekdays: [0, 2],
    shift: "matin",
    startTime: "08:00",
    endTime: "10:00",
    label: "Anglais A1",
    startDate: "2026-11-01",
  };
  const { entries, skipped } = planMonth([assignment], "2026-11", [
    { staffId: "s1", startDate: "2026-11-10", endDate: "2026-11-10" },
  ]);
  // Novembre 2026 : 5 dimanches et 4 mardis, dont le 10 en congé.
  assert.equal(entries.length, 8);
  assert.equal(skipped, 1);
  assert.ok(entries.every((entry) => [0, 2].includes(weekday(entry.date))));
  assert.deepEqual(leaveDates({ startDate: "2026-10-29", endDate: "2026-11-01" }, [5]), [
    "2026-10-29",
    "2026-10-31",
    "2026-11-01",
  ]);
});

test("paie : 24 h validées à 2 000 FDJ = 48 000 FDJ (exemple du cahier des charges)", () => {
  const slip = computePayslip({
    staff: { payType: "hourly", hourlyRate: 2000 },
    period: "2026-10",
    attendance: [
      { status: "present", hours: 20 },
      { status: "late", hours: 4 },
      { status: "absent", hours: 0 },
    ],
  });
  assert.equal(slip.hours, 24);
  assert.equal(slip.gross, 48000);
  assert.equal(slip.net, 48000);
});

test("paie : salaire mensuel, prime, retenue, absence et remboursement d’avance", () => {
  const advance = {
    _id: "adv",
    type: "advance",
    amount: 30000,
    repaymentMonths: 2,
    period: "2026-10",
    repaymentStart: "2026-11",
    disbursed: { paid: true },
  };
  const slip = computePayslip({
    staff: { payType: "monthly", monthlySalary: 130000 },
    period: "2026-11",
    adjustments: [
      { _id: "b", type: "bonus", amount: 10000, period: "2026-11", label: "Prime" },
      { _id: "d", type: "deduction", amount: 5000, period: "2026-11" },
      { _id: "x", type: "bonus", amount: 99999, period: "2026-12" },
      advance,
    ],
    absenceDates: ["2026-11-03"],
    settings: { deductAbsences: true, workingDaysPerMonth: 26 },
  });
  assert.equal(slip.gross, 140000);
  // 5 000 de retenue + 5 000 d’absence (130 000 / 26) + 15 000 d’avance.
  assert.equal(slip.totalDeductions, 25000);
  assert.equal(slip.net, 115000);
  assert.equal(advanceInstallment(advance, "2026-10"), 0);
  assert.equal(advanceInstallment(advance, "2026-12", 15000), 15000);
  assert.equal(advanceInstallment(advance, "2027-01", 15000), 0);
  // Une avance non versée n’est pas retenue.
  const unpaid = computePayslip({
    staff: { payType: "flat", flatAmount: 50000 },
    period: "2026-11",
    adjustments: [{ ...advance, disbursed: { paid: false } }],
  });
  assert.equal(unpaid.net, 50000);
});

test("échéancier : intégral, 3 mois, personnalisé (total exact exigé)", () => {
  assert.deepEqual(
    buildInstallments({ plan: "full", total: 90000, startDate: "2026-11-05" }).map((item) => item.amount),
    [90000],
  );
  const three = buildInstallments({ plan: "installments", total: 100000, count: 3, startDate: "2026-11-05" });
  assert.deepEqual(three.map((item) => item.amount), [33333, 33333, 33334]);
  assert.deepEqual(three.map((item) => item.dueDate), ["2026-11-05", "2026-12-05", "2027-01-05"]);
  assert.throws(
    () =>
      buildInstallments({
        plan: "custom",
        total: 50000,
        startDate: "2026-11-05",
        custom: [{ dueDate: "2026-11-10", amount: 20000 }],
      }),
    /exactement/,
  );
});

test("impayés : affectation des paiements aux échéances les plus anciennes", () => {
  const installments = [
    { dueDate: "2026-10-01", amount: 30000 },
    { dueDate: "2026-11-01", amount: 30000 },
    { dueDate: "2026-12-01", amount: 30000 },
  ];
  const schedule = allocate(installments, 40000, "2026-11-15");
  assert.deepEqual(
    schedule.map((item) => [item.status, item.remaining]),
    [
      ["paid", 0],
      ["overdue", 20000],
      ["upcoming", 30000],
    ],
  );
  const summary = summarize({ installments, totalAmount: 90000, paidAmount: 40000 }, "2026-11-15");
  assert.equal(summary.balance, 50000);
  assert.equal(summary.overdueAmount, 20000);
  assert.equal(summary.paymentStatus, "overdue");
  assert.equal(invoiceStatus({ total: 1000, dueDate: "2026-11-01" }, 0, "2026-11-15"), "overdue");
  assert.equal(invoiceStatus({ total: 1000 }, 1000), "paid");
  assert.equal(discountValue({ kind: "percent", value: 10 }, 90000), 9000);
  assert.equal(discountValue({ kind: "fixed", value: 200000 }, 90000), 90000);
});
