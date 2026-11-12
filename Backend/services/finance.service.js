import mongoose from "mongoose";
import {
  FinanceAccount,
  StudentAccount,
  Payment,
  ExpenseCategory,
  Expense,
  StaffPayment,
  Transfer,
} from "../models/finance.models.js";
import { PayAdjustment, Payslip } from "../models/hr.models.js";
import { PlatformSetting } from "../models/platform.models.js";
import { addMonthsToDay, today } from "./dates.js";

// Répartit `total` en `count` échéances mensuelles égales (le reste sur la
// dernière). Échéancier personnalisé : la liste fournie doit faire le total.
export function buildInstallments({ plan, total, count = 1, startDate, custom = [] }) {
  if (plan === "custom") {
    const sum = custom.reduce((value, item) => value + item.amount, 0);
    if (!custom.length || sum !== total)
      throw Object.assign(
        new Error(
          `Les échéances (${sum}) doivent faire exactement le montant dû (${total}).`,
        ),
        { status: 400, expose: true },
      );
    return [...custom]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((item, index) => ({
        label: item.label || `Versement ${index + 1}/${custom.length}`,
        dueDate: item.dueDate,
        amount: item.amount,
      }));
  }
  const parts = plan === "full" ? 1 : Math.max(1, Math.min(60, count));
  const share = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, index) => ({
    label:
      plan === "full"
        ? "Paiement intégral"
        : `${plan === "monthly" ? "Mensualité" : "Versement"} ${index + 1}/${parts}`,
    dueDate: addMonthsToDay(startDate, index),
    amount: index === parts - 1 ? total - share * (parts - 1) : share,
  }));
}

// Affecte les sommes payées aux échéances, de la plus ancienne à la plus récente.
export function allocate(installments, paid, day = today()) {
  let left = paid;
  return [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => {
      const covered = Math.min(item.amount, Math.max(0, left));
      left -= covered;
      const remaining = item.amount - covered;
      const status = !remaining
        ? "paid"
        : item.dueDate < day
          ? "overdue"
          : covered
            ? "partial"
            : "upcoming";
      return { ...item, paid: covered, remaining, status };
    });
}

export function summarize(account, day = today()) {
  const schedule = allocate(account.installments || [], account.paidAmount || 0, day);
  const overdue = schedule.filter((item) => item.status === "overdue");
  const next = schedule.find((item) => item.remaining > 0);
  return {
    schedule,
    balance: Math.max(0, (account.totalAmount || 0) - (account.paidAmount || 0)),
    overdueAmount: overdue.reduce((sum, item) => sum + item.remaining, 0),
    overdueCount: overdue.length,
    nextDue: next ? { dueDate: next.dueDate, amount: next.remaining } : null,
    paymentStatus:
      account.status === "cancelled"
        ? "cancelled"
        : (account.paidAmount || 0) >= (account.totalAmount || 0)
          ? "paid"
          : overdue.length
            ? "overdue"
            : account.paidAmount
              ? "partial"
              : "unpaid",
  };
}

export function invoiceStatus(invoice, paid, day = today()) {
  if (invoice.status === "cancelled") return "cancelled";
  if (paid >= invoice.total) return "paid";
  if (invoice.dueDate && invoice.dueDate < day) return "overdue";
  return paid > 0 ? "partial" : "unpaid";
}

export const discountValue = (discount, base) =>
  !discount
    ? 0
    : Math.min(
        base,
        Math.round(
          discount.kind === "percent" ? (base * discount.value) / 100 : discount.value,
        ),
      );

const id = (value) => new mongoose.Types.ObjectId(String(value));

export async function refreshStudentAccount(accountId) {
  const [result] = await Payment.aggregate([
    { $match: { studentAccountId: id(accountId), status: "confirmed" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const account = await StudentAccount.findById(accountId);
  if (!account) return null;
  account.paidAmount = result?.total || 0;
  if (account.status !== "cancelled")
    account.status = account.paidAmount >= account.totalAmount ? "completed" : "active";
  await account.save();
  return account;
}

export async function invoicePaid(invoiceIds) {
  const rows = await Payment.aggregate([
    { $match: { invoiceId: { $in: invoiceIds.map(id) }, status: "confirmed" } },
    { $group: { _id: "$invoiceId", total: { $sum: "$amount" } } },
  ]);
  return Object.fromEntries(rows.map((row) => [String(row._id), row.total]));
}

export async function refreshPayslip(payslipId) {
  const [result] = await StaffPayment.aggregate([
    { $match: { payslipId: id(payslipId), status: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const slip = await Payslip.findById(payslipId);
  if (!slip || slip.status === "draft") return slip;
  slip.paidAmount = result?.total || 0;
  slip.status =
    slip.paidAmount >= slip.net ? "paid" : slip.paidAmount ? "partial" : "validated";
  await slip.save();
  return slip;
}

// Mouvements de trésorerie : entrées positives, sorties négatives.
async function movementSources(match = {}) {
  const dateFilter = match.date ? { date: match.date } : {};
  const accountFilter = (field) => (match.accountId ? { [field]: id(match.accountId) } : {});
  const [payments, expenses, staff, advances, transfersOut, transfersIn] =
    await Promise.all([
      Payment.aggregate([
        { $match: { status: "confirmed", ...dateFilter } },
        { $unwind: "$splits" },
        ...(match.accountId
          ? [{ $match: { "splits.accountId": id(match.accountId) } }]
          : []),
        {
          $project: {
            date: 1,
            accountId: "$splits.accountId",
            amount: "$splits.amount",
            method: "$splits.method",
            label: { $concat: ["Paiement ", "$studentName"] },
            reference: "$receiptNumber",
          },
        },
      ]),
      Expense.find({ status: "validated", ...dateFilter, ...accountFilter("accountId") })
        .select("date accountId amount method beneficiary categoryName reference")
        .lean(),
      StaffPayment.find({ status: "paid", ...dateFilter, ...accountFilter("accountId") })
        .select("date accountId amount method staffName period reference")
        .lean(),
      PayAdjustment.find({
        type: "advance",
        "disbursed.paid": true,
        ...(match.accountId ? { "disbursed.accountId": id(match.accountId) } : {}),
      })
        .populate("staffId", "fullName")
        .lean(),
      Transfer.find({ status: "done", ...dateFilter, ...accountFilter("fromAccountId") }).lean(),
      Transfer.find({ status: "done", ...dateFilter, ...accountFilter("toAccountId") }).lean(),
    ]);
  const inRange = (date) =>
    !match.date ||
    ((!match.date.$gte || date >= match.date.$gte) &&
      (!match.date.$lte || date <= match.date.$lte));
  return [
    ...payments.map((item) => ({
      kind: "student_payment",
      date: item.date,
      accountId: item.accountId,
      amount: item.amount,
      label: item.label,
      reference: item.reference,
    })),
    ...expenses.map((item) => ({
      kind: "expense",
      date: item.date,
      accountId: item.accountId,
      amount: -item.amount,
      label: `${item.categoryName} · ${item.beneficiary}`,
      reference: item.reference,
      category: item.categoryName,
    })),
    ...staff.map((item) => ({
      kind: "staff_payment",
      date: item.date,
      accountId: item.accountId,
      amount: -item.amount,
      label: `Rémunération ${item.staffName} (${item.period})`,
      reference: item.reference,
    })),
    ...advances
      .map((item) => ({
        kind: "advance",
        date: today(item.disbursed.paidAt || item.updatedAt),
        accountId: item.disbursed.accountId,
        amount: -item.amount,
        label: `Avance ${item.staffId?.fullName || ""}`.trim(),
        reference: item.disbursed.reference || "",
      }))
      .filter((item) => inRange(item.date)),
    ...transfersOut.map((item) => ({
      kind: "transfer_out",
      date: item.date,
      accountId: item.fromAccountId,
      amount: -item.amount,
      label: "Transfert sortant",
      reference: item.reference,
    })),
    ...transfersIn.map((item) => ({
      kind: "transfer_in",
      date: item.date,
      accountId: item.toAccountId,
      amount: item.amount,
      label: "Transfert entrant",
      reference: item.reference,
    })),
  ];
}

export async function accountBalances() {
  const [accounts, movements] = await Promise.all([
    FinanceAccount.find().sort({ kind: 1, name: 1 }).lean(),
    movementSources(),
  ]);
  return accounts.map((account) => {
    const mine = movements.filter((item) => String(item.accountId) === String(account._id));
    const inflow = mine.filter((item) => item.amount > 0).reduce((s, i) => s + i.amount, 0);
    const outflow = mine.filter((item) => item.amount < 0).reduce((s, i) => s - i.amount, 0);
    return {
      ...account,
      inflow,
      outflow,
      balance: (account.openingBalance || 0) + inflow - outflow,
    };
  });
}

export async function accountMovements(accountId, { from, to } = {}) {
  const date = {};
  if (from) date.$gte = from;
  if (to) date.$lte = to;
  const items = await movementSources({
    accountId,
    ...(from || to ? { date } : {}),
  });
  return items
    .filter((item) => String(item.accountId) === String(accountId))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const sumBy = (items, key, value = (item) => item.amount) => {
  const result = {};
  for (const item of items) result[key(item)] = (result[key(item)] || 0) + value(item);
  return result;
};

export async function financeDashboard({ from, to }) {
  const day = today();
  const range = { $gte: from, $lte: to };
  const [accounts, payments, balances, expenses, slips, staffPaid, movements] =
    await Promise.all([
      StudentAccount.find({ status: { $ne: "cancelled" } }).lean(),
      Payment.find({ status: "confirmed", date: range }).lean(),
      accountBalances(),
      Expense.find({ status: "validated", date: range }).lean(),
      Payslip.find({ status: { $in: ["validated", "partial", "paid"] }, period: { $gte: from.slice(0, 7), $lte: to.slice(0, 7) } }).lean(),
      StaffPayment.find({ status: "paid", date: range }).lean(),
      movementSources({ date: range }),
    ]);
  const billed = accounts.reduce((sum, item) => sum + item.totalAmount, 0);
  const collectedAll = accounts.reduce((sum, item) => sum + item.paidAmount, 0);
  const upcomingLimit = addMonthsToDay(day, 1);
  const upcoming = [];
  const overdue = [];
  for (const account of accounts) {
    const { schedule } = summarize(account, day);
    for (const item of schedule) {
      const row = {
        accountId: account._id,
        reference: account.reference,
        studentName: account.studentName,
        courseTitle: account.courseTitle,
        phone: account.phone,
        dueDate: item.dueDate,
        label: item.label,
        remaining: item.remaining,
      };
      if (item.status === "overdue") overdue.push(row);
      else if (item.remaining && item.dueDate <= upcomingLimit) upcoming.push(row);
    }
  }
  const pendingExpenses = await Expense.countDocuments({ status: "pending" });
  const pendingStaff = await StaffPayment.countDocuments({ status: { $in: ["pending", "approved"] } });
  // Les transferts entre comptes ne sont ni des recettes ni des dépenses.
  const monthly = {};
  for (const item of movements) {
    if (item.kind === "transfer_in" || item.kind === "transfer_out") continue;
    const key = item.date.slice(0, 7);
    monthly[key] ||= {
      month: key,
      inflow: 0,
      outflow: 0,
      student_payment: 0,
      expense: 0,
      staff_payment: 0,
      advance: 0,
    };
    monthly[key][item.kind] += Math.abs(item.amount);
    if (item.amount > 0) monthly[key].inflow += item.amount;
    else monthly[key].outflow -= item.amount;
  }
  return {
    period: { from, to },
    totals: {
      billed,
      collectedAll,
      receivable: Math.max(0, billed - collectedAll),
      collected: payments.reduce((sum, item) => sum + item.amount, 0),
      expenses: expenses.reduce((sum, item) => sum + item.amount, 0),
      salariesPaid: staffPaid.reduce((sum, item) => sum + item.amount, 0),
      salariesDue: slips.reduce((sum, item) => sum + Math.max(0, item.net - item.paidAmount), 0),
      overdueAmount: overdue.reduce((sum, item) => sum + item.remaining, 0),
      pendingExpenses,
      pendingStaff,
    },
    upcoming: upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12),
    overdue: overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    byMethod: sumBy(
      payments.flatMap((item) => item.splits),
      (split) => split.method,
    ),
    byCourse: sumBy(payments, (item) => item.courseId || "autre"),
    byCategory: sumBy(expenses, (item) => item.categoryName || "Autres"),
    monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
    balances: balances.map(({ _id, name, kind, balance, active }) => ({
      _id,
      name,
      kind,
      balance,
      active,
    })),
  };
}

const defaultAccounts = [
  { name: "Caisse principale (espèces)", kind: "cash" },
  { name: "Compte bancaire principal", kind: "bank" },
  { name: "D-Money", kind: "dmoney" },
  { name: "Waafi", kind: "waafi" },
  { name: "CAC Pay", kind: "cacpay" },
  { name: "Saba Pay", kind: "sabapay" },
];
const defaultCategories = [
  ["Loyer", "Loyer des locaux du centre"],
  ["Électricité", "Factures et dépannages électriques"],
  ["Eau", "Factures d’eau"],
  ["Internet", "Abonnement internet et réseau"],
  ["Fournitures", "Papier, feuilles blanches, stylos, marqueurs, cahiers"],
  ["Matériel informatique", "Ordinateurs, imprimantes, vidéoprojecteurs"],
  ["Mobilier", "Tables, chaises, armoires, tableaux"],
  ["Climatisation", "Achat, entretien et réparation des climatiseurs"],
  ["Entretien et réparations", "Nettoyage, plomberie, petits travaux"],
  ["Communication", "Téléphone, publicité, impression de supports"],
  ["Autres charges", "Dépenses qui n’entrent dans aucune autre catégorie"],
];
// Comptes et catégories de départ, créés une seule fois : l’utilisateur peut
// ensuite les renommer ou les désactiver sans qu’ils réapparaissent.
export async function seedFinance() {
  if (await PlatformSetting.exists({ _id: "finance-defaults" })) return;
  if ((await FinanceAccount.countDocuments()) === 0)
    await FinanceAccount.insertMany(defaultAccounts);
  if ((await ExpenseCategory.countDocuments()) === 0)
    await ExpenseCategory.insertMany(
      defaultCategories.map(([name, description]) => ({ name, description })),
    );
  await PlatformSetting.updateOne(
    { _id: "finance-defaults" },
    { $setOnInsert: { initializedAt: new Date() } },
    { upsert: true },
  );
}
