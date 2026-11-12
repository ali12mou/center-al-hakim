import { Router } from "express";
import { z } from "zod";
import {
  FinanceAccount,
  FeeRate,
  Discount,
  StudentAccount,
  Payment,
  Invoice,
  ExpenseCategory,
  Expense,
  StaffPayment,
  Transfer,
} from "../models/finance.models.js";
import { PayAdjustment, Payslip } from "../models/hr.models.js";
import { Course } from "../models/index.js";
import { nextNumber } from "../models/system.models.js";
import { permit } from "../middleware/admin.middleware.js";
import { can } from "../config/permissions.js";
import {
  crudRoutes,
  parseBody,
  sendError,
  httpError,
  actor,
  validId,
  v,
} from "../services/crud.js";
import {
  accountBalances,
  accountMovements,
  buildInstallments,
  discountValue,
  financeDashboard,
  invoicePaid,
  invoiceStatus,
  refreshPayslip,
  refreshStudentAccount,
  summarize,
} from "../services/finance.service.js";
import { getSettings, saveSettings } from "../services/settings.service.js";
import { addStudentFinanceRoutes, studentPaymentCounts } from "./finance-students.routes.js";
import { addDays, currentMonth, today } from "../services/dates.js";
import {
  accountSchema,
  feeSchema,
  discountSchema,
  studentAccountSchema,
  paymentSchema,
  paymentUpdateSchema,
  invoiceSchema,
  categorySchema,
  expenseSchema,
  staffPaymentSchema,
  transferSchema,
  advanceSchema,
  disburseSchema,
  labels,
} from "../validators/finance.validator.js";

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
const reason = z.object({ reason: z.string().trim().min(3).max(300) });
const byId = (field) => (value) => (validId(value) ? { [field]: value } : {});
const money = (value) => new Intl.NumberFormat("fr-FR").format(value);
// La méthode d’un règlement découle du compte qui reçoit ou verse l’argent.
async function activeAccount(id) {
  const account = await FinanceAccount.findById(id).lean();
  if (!account) throw httpError(400, "Compte introuvable.");
  if (!account.active) throw httpError(409, `Le compte « ${account.name} » est désactivé.`);
  return account;
}
async function courseTitle(courseId) {
  if (!courseId) return "";
  return (await Course.findOne({ id: courseId }).select("title").lean())?.title || courseId;
}
const disbursedDate = (day) => new Date(`${day}T12:00:00+03:00`);
const FEE_TYPE_LABELS = {
  monthly: "Frais mensuel",
  registration: "Frais d’inscription",
  training: "Frais de formation",
  exam: "Frais d’examen",
  certificate: "Frais de certificat",
  other: "Autre frais",
};

// Contrôles communs à tout paiement de student (page « Enregistrer un paiement »
// et « Encaissements ») : dossier actif, comptes actifs, solde, facture liée.
export async function preparePayment(data, req) {
  const account = await StudentAccount.findById(data.studentAccountId);
  if (!account) throw httpError(400, "Dossier du student introuvable.");
  if (account.status === "cancelled") throw httpError(409, "Ce dossier est annulé.");
  const { paymentMethods } = await getSettings("finance");
  for (const split of data.splits) {
    const target = await activeAccount(split.accountId);
    split.method = target.kind;
    if (!paymentMethods.includes(split.method))
      throw httpError(409, "Ce moyen de paiement est désactivé dans les paramètres financiers.");
  }
  const amount = data.splits.reduce((sum, split) => sum + split.amount, 0);
  const balance = account.totalAmount - account.paidAmount;
  if (amount > balance)
    throw httpError(400, `Le montant (${money(amount)}) dépasse le solde restant (${money(balance)}).`);
  if (data.invoiceId) {
    const invoice = await Invoice.findOne({ _id: data.invoiceId, studentAccountId: account._id, status: "issued" });
    if (!invoice) throw httpError(400, "Facture introuvable pour ce dossier.");
  } else {
    const invoice = await Invoice.findOne({ studentAccountId: account._id, status: "issued" })
      .sort({ issueDate: -1 })
      .select("_id")
      .lean();
    if (invoice) data.invoiceId = invoice._id;
  }
  return {
    ...data,
    amount,
    reference: await nextNumber("PAY"),
    receiptNumber: await nextNumber("REC"),
    studentName: account.studentName,
    courseId: account.courseId,
    mode: "manual",
    status: "confirmed",
    recordedBy: actor(req),
  };
}

export function createFinanceRouter() {
  const router = Router();
  addStudentFinanceRoutes(router);

  // Caisse et comptes (espèces, banque, portefeuilles mobiles).
  router.get(
    "/accounts/balances",
    permit("finance.accounts", "view"),
    wrap(async (_req, res) => res.json({ items: await accountBalances() })),
  );
  router.get(
    "/accounts/:id/movements",
    permit("finance.accounts", "view"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const day = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : undefined);
      res.json({
        items: await accountMovements(req.params.id, {
          from: day(req.query.from),
          to: day(req.query.to),
        }),
      });
    }),
  );
  crudRoutes(router, {
    path: "/accounts",
    model: FinanceAccount,
    schema: accountSchema,
    labels,
    section: "finance.accounts",
    search: ["name", "number", "holder", "bankName"],
    filters: { kind: (value) => ({ kind: value }) },
    sort: { kind: 1, name: 1 },
    async beforeDelete(record) {
      if ((await accountMovements(record._id)).length)
        throw httpError(409, "Ce compte a des mouvements : désactivez-le plutôt que de le supprimer.");
    },
  });

  // Frais de formation.
  crudRoutes(router, {
    path: "/fees",
    model: FeeRate,
    schema: feeSchema,
    labels,
    section: "finance.fees",
    search: ["label", "courseId"],
    filters: { courseId: (value) => ({ courseId: value }), active: (value) => ({ active: value === "true" }) },
    sort: { active: -1, label: 1 },
    serialize: async (item) => ({ ...item, courseTitle: await courseTitle(item.courseId) }),
    // Pas de libellé saisi : le nom du frais suit son type et sa formation.
    async prepare(data, { record }) {
      const merged = { ...(record?.toObject() || {}), ...data };
      if (!(await Course.exists({ id: merged.courseId }))) throw httpError(400, "Formation introuvable.");
      data.label = `${FEE_TYPE_LABELS[merged.feeType] || FEE_TYPE_LABELS.training} – ${await courseTitle(merged.courseId)}`;
      return data;
    },
  });
  crudRoutes(router, {
    path: "/discounts",
    model: Discount,
    schema: discountSchema,
    labels,
    section: "finance.discounts",
    search: ["name", "description"],
    sort: { active: -1, name: 1 },
    async prepare(data, { record }) {
      const kind = data.kind || record?.kind;
      const value = data.value ?? record?.value;
      if (kind === "percent" && value > 100)
        throw httpError(400, "Valeur : un pourcentage ne dépasse pas 100.");
      return data;
    },
  });

  // Dossiers financiers des students et échéanciers.
  const amountKeys = [
    "feeId",
    "baseAmount",
    "registrationFee",
    "discountId",
    "manualDiscount",
    "plan",
    "count",
    "startDate",
    "installments",
  ];
  crudRoutes(router, {
    path: "/student-accounts",
    model: StudentAccount,
    schema: studentAccountSchema,
    labels,
    section: "finance.schedules",
    search: ["studentName", "reference", "phone", "email", "payer.name", "courseTitle"],
    filters: {
      status: (value) => ({ status: value }),
      courseId: (value) => ({ courseId: value }),
      plan: (value) => ({ plan: value }),
    },
    readOnly: ["reference", "paidAmount", "history", "registrationId"],
    serialize: (item) => ({ ...item, ...summarize(item) }),
    async prepare(data, { req, record }) {
      const { count, reason: why, ...fields } = data;
      const history = [];
      const by = req.admin.name;
      if (!record || amountKeys.some((key) => key in data)) {
        const merged = { ...(record?.toObject() || {}), ...fields };
        let fee = null;
        if (merged.feeId) {
          fee = await FeeRate.findById(merged.feeId).lean();
          if (!fee) throw httpError(400, "Tarif introuvable.");
        }
        if (!record && fee) {
          if (!fields.baseAmount) fields.baseAmount = merged.baseAmount = fee.amount;
          if (!fields.registrationFee)
            fields.registrationFee = merged.registrationFee = fee.registrationFee;
          if (!fields.courseId) fields.courseId = merged.courseId = fee.courseId;
        }
        const discount = merged.discountId
          ? await Discount.findById(merged.discountId).lean()
          : null;
        if (merged.discountId && !discount) throw httpError(400, "Remise introuvable.");
        const base = merged.baseAmount || 0;
        fields.discountAmount = Math.min(
          base + (merged.registrationFee || 0),
          discountValue(discount, base) + (merged.manualDiscount || 0),
        );
        fields.discountLabel = [discount?.name, merged.manualDiscount ? merged.discountReason || "Remise accordée" : ""]
          .filter(Boolean)
          .join(" + ");
        fields.totalAmount = base + (merged.registrationFee || 0) - fields.discountAmount;
        if (record && fields.totalAmount < record.paidAmount)
          throw httpError(409, `Le nouveau montant est inférieur à ce qui a déjà été payé (${money(record.paidAmount)}).`);
        fields.installments = buildInstallments({
          plan: merged.plan,
          total: fields.totalAmount,
          count: count || merged.installments?.length || 1,
          startDate: merged.startDate,
          custom: merged.plan === "custom" ? fields.installments || merged.installments : [],
        });
        fields.courseTitle = await courseTitle(merged.courseId);
        const plans = { full: "paiement intégral", monthly: "mensuel", installments: "échelonné", custom: "personnalisé" };
        const describe = (value) =>
          `${plans[value.plan]}, ${value.installments.length} échéance(s), ${money(value.totalAmount)}`;
        if (!record) history.push({ by, action: "Dossier créé", detail: describe(fields) });
        else {
          const before = JSON.stringify(record.installments.map(({ dueDate, amount }) => [dueDate, amount]));
          const after = JSON.stringify(fields.installments.map(({ dueDate, amount }) => [dueDate, amount]));
          if (before !== after || record.totalAmount !== fields.totalAmount)
            history.push({
              by,
              action: "Échéancier modifié",
              detail: `Avant : ${describe(record)}. Après : ${describe({ ...merged, ...fields })}.${why ? ` Motif : ${why}` : ""}`,
            });
        }
      }
      if (record && fields.status && fields.status !== record.status) {
        if (fields.status === "cancelled" && !why)
          throw httpError(400, "Indiquez le motif de l’annulation du dossier.");
        history.push({ by, action: `Statut : ${fields.status}`, detail: why });
      }
      if (!record) {
        fields.reference = await nextNumber("DOS");
        fields.status = "active";
      }
      if (history.length) fields.history = [...(record?.history || []), ...history];
      return fields;
    },
    async beforeDelete(record) {
      if ((await Payment.exists({ studentAccountId: record._id })) || (await Invoice.exists({ studentAccountId: record._id })))
        throw httpError(409, "Ce dossier a des paiements ou des factures : annulez-le plutôt que de le supprimer.");
    },
  });
  router.get(
    "/student-accounts/:id/statement",
    permit("finance.schedules", "view"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const [payments, invoices] = await Promise.all([
        Payment.find({ studentAccountId: req.params.id }).sort({ date: -1 }).lean(),
        Invoice.find({ studentAccountId: req.params.id }).sort({ issueDate: -1 }).lean(),
      ]);
      const paid = await invoicePaid(invoices.map((item) => item._id));
      res.json({
        payments,
        invoices: invoices.map((item) => ({
          ...item,
          paid: paid[String(item._id)] || 0,
          paymentStatus: invoiceStatus(item, paid[String(item._id)] || 0),
        })),
      });
    }),
  );
  router.get(
    "/receivables",
    permit("finance.schedules", "view"),
    wrap(async (req, res) => {
      const accounts = await StudentAccount.find({ status: "active" }).lean();
      const day = today();
      const items = accounts
        .map((account) => ({ ...account, ...summarize(account, day) }))
        .filter((item) =>
          req.query.status === "overdue" ? item.overdueAmount > 0 : item.balance > 0,
        )
        .sort((a, b) => b.overdueAmount - a.overdueAmount || (a.nextDue?.dueDate || "").localeCompare(b.nextDue?.dueDate || ""));
      res.json({
        items,
        totals: {
          balance: items.reduce((sum, item) => sum + item.balance, 0),
          overdue: items.reduce((sum, item) => sum + item.overdueAmount, 0),
          accounts: items.length,
        },
      });
    }),
  );

  // Paiements des students.
  crudRoutes(router, {
    path: "/payments",
    model: Payment,
    schema: paymentSchema,
    labels,
    section: "finance.payments",
    only: ["list", "detail", "create"],
    search: ["studentName", "reference", "receiptNumber", "splits.transactionRef"],
    dateField: "date",
    filters: {
      status: (value) => ({ status: value }),
      method: (value) => ({ "splits.method": value }),
      accountId: byId("splits.accountId"),
      studentAccountId: byId("studentAccountId"),
      courseId: (value) => ({ courseId: value }),
    },
    sort: { date: -1, createdAt: -1 },
    populate: [
      ["studentAccountId", "reference studentName phone courseTitle totalAmount paidAmount payer"],
      ["splits.accountId", "name kind number"],
      ["invoiceId", "number"],
    ],
    prepare: (data, { req }) => preparePayment(data, req),
    after: (record) => refreshStudentAccount(record.studentAccountId),
  });
  router.patch(
    "/payments/:id",
    permit("finance.payments", "update"),
    wrap(async (req, res) => {
      const data = parseBody(paymentUpdateSchema.partial(), req.body);
      const item = await Payment.findByIdAndUpdate(validId(req.params.id) ? req.params.id : null, { $set: data }, { new: true });
      if (!item) throw httpError(404, "Paiement introuvable.");
      res.json({ item });
    }),
  );
  router.post(
    "/payments/:id/cancel",
    permit("finance.payments", "delete"),
    wrap(async (req, res) => {
      const { reason: why } = parseBody(reason, req.body, { reason: "Motif" });
      const item = await Payment.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Paiement introuvable.");
      if (item.status === "cancelled") throw httpError(409, "Ce paiement est déjà annulé.");
      item.set({ status: "cancelled", cancelReason: why, cancelledBy: actor(req), cancelledAt: new Date() });
      await item.save();
      await refreshStudentAccount(item.studentAccountId);
      await StudentAccount.updateOne(
        { _id: item.studentAccountId },
        { $push: { history: { by: req.admin.name, action: `Paiement ${item.receiptNumber} annulé`, detail: why } } },
      );
      res.json({ item });
    }),
  );

  // Factures.
  crudRoutes(router, {
    path: "/invoices",
    model: Invoice,
    schema: invoiceSchema,
    labels,
    section: "finance.invoices",
    only: ["list", "detail", "create", "update"],
    search: ["number", "billTo.name"],
    dateField: "issueDate",
    filters: { studentAccountId: byId("studentAccountId"), status: (value) => ({ status: value }) },
    sort: { issueDate: -1, number: -1 },
    populate: [["studentAccountId", "reference studentName courseTitle phone totalAmount paidAmount"]],
    readOnly: ["number", "studentAccountId", "status", "history"],
    async serialize(item) {
      const paid = (await invoicePaid([item._id]))[String(item._id)] || 0;
      return { ...item, paid, paymentStatus: invoiceStatus(item, paid) };
    },
    async prepare(data, { req, record }) {
      if (record?.status === "cancelled") throw httpError(409, "Cette facture est annulée.");
      const { reason: why, ...fields } = data;
      const account = record
        ? await StudentAccount.findById(record.studentAccountId).lean()
        : await StudentAccount.findById(data.studentAccountId).lean();
      if (!account) throw httpError(400, "Dossier du student introuvable.");
      if (!record && !fields.lines.length) {
        fields.lines = [{ label: `Formation : ${account.courseTitle || "—"}`, quantity: 1, unitPrice: account.baseAmount }];
        if (account.registrationFee)
          fields.lines.push({ label: "Frais d’inscription", quantity: 1, unitPrice: account.registrationFee });
        if (!fields.discount) fields.discount = account.discountAmount;
      }
      if (fields.lines || "discount" in fields) {
        const lines = (fields.lines || record.lines).map((line) => ({
          label: line.label,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: Math.round(line.quantity * line.unitPrice),
        }));
        const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
        const discount = Math.min(subtotal, fields.discount ?? record.discount);
        Object.assign(fields, { lines, subtotal, discount, total: subtotal - discount });
        if (record && fields.total !== record.total && !why)
          throw httpError(400, "Indiquez le motif de la correction de la facture.");
      }
      if (!record) {
        const settings = await getSettings("finance");
        const organisation = account.payer?.type === "organisation" && account.payer.name;
        fields.billTo = {
          kind: organisation ? "organisation" : "student",
          name: fields.billTo?.name || (organisation ? account.payer.name : account.studentName),
          address: fields.billTo?.address || "",
          contact: fields.billTo?.contact || (organisation ? account.payer.contact : account.phone || account.email),
        };
        fields.dueDate ||= addDays(fields.issueDate, settings.invoiceDueDays);
        fields.number = await nextNumber("FAC");
        fields.history = [{ by: req.admin.name, action: "Facture émise", detail: `${money(fields.total)}` }];
      } else
        fields.history = [
          ...record.history,
          { by: req.admin.name, action: "Facture corrigée", detail: why || "Mise à jour des informations" },
        ];
      return fields;
    },
  });
  router.post(
    "/invoices/:id/cancel",
    permit("finance.invoices", "delete"),
    wrap(async (req, res) => {
      const { reason: why } = parseBody(reason, req.body, { reason: "Motif" });
      const item = await Invoice.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Facture introuvable.");
      if (item.status === "cancelled") throw httpError(409, "Cette facture est déjà annulée.");
      item.set({ status: "cancelled", cancelReason: why });
      item.history.push({ by: req.admin.name, action: "Facture annulée", detail: why });
      await item.save();
      // Les paiements restent acquis au dossier du student.
      await Payment.updateMany({ invoiceId: item._id }, { $unset: { invoiceId: 1 } });
      res.json({ item });
    }),
  );

  // Dépenses du centre.
  crudRoutes(router, {
    path: "/expense-categories",
    model: ExpenseCategory,
    schema: categorySchema,
    labels,
    section: "finance.expenseCategories",
    search: ["name", "description"],
    sort: { active: -1, name: 1 },
    async beforeDelete(record) {
      if (await Expense.exists({ categoryId: record._id }))
        throw httpError(409, "Des dépenses utilisent cette catégorie : désactivez-la plutôt.");
    },
  });
  crudRoutes(router, {
    path: "/expenses",
    model: Expense,
    schema: expenseSchema,
    labels,
    section: "finance.expenses",
    search: ["beneficiary", "description", "reference", "categoryName", "transactionRef"],
    dateField: "date",
    filters: {
      status: (value) => ({ status: value }),
      categoryId: byId("categoryId"),
      accountId: byId("accountId"),
    },
    sort: { date: -1, createdAt: -1 },
    populate: [["accountId", "name kind"]],
    readOnly: ["reference", "status", "decidedBy", "decidedAt", "recordedBy"],
    async prepare(data, { req, record }) {
      const approver = can(req.admin, "finance.expenses", "approve");
      if (record?.status === "validated" && !approver)
        throw httpError(409, "Cette dépense est validée. Seul un responsable peut la modifier.");
      if (data.categoryId) {
        const category = await ExpenseCategory.findById(data.categoryId).lean();
        if (!category?.active) throw httpError(400, "Catégorie introuvable ou désactivée.");
        data.categoryName = category.name;
        if (category.requiresProof && !(data.proofUrl ?? record?.proofUrl))
          throw httpError(400, `La catégorie « ${category.name} » exige un justificatif.`);
      }
      if (data.accountId) data.method = (await activeAccount(data.accountId)).kind;
      const { expenseApprovalThreshold: threshold } = await getSettings("finance");
      const amount = data.amount ?? record?.amount;
      if (!record || "amount" in data) {
        const needsApproval = threshold > 0 && amount >= threshold;
        if (needsApproval && !approver) data.status = "pending";
        else if (!record || record.status !== "rejected") {
          data.status = "validated";
          if (needsApproval) Object.assign(data, { decidedBy: actor(req), decidedAt: new Date() });
        }
      }
      if (!record) Object.assign(data, { reference: await nextNumber("DEP"), recordedBy: actor(req) });
      return data;
    },
    async beforeDelete(record, req) {
      if (record.status === "validated" && !can(req.admin, "finance.expenses", "approve"))
        throw httpError(409, "Cette dépense est validée. Seul un responsable peut la supprimer.");
    },
  });
  router.post(
    "/expenses/:id/decision",
    permit("finance.expenses", "approve"),
    wrap(async (req, res) => {
      const { status, note } = parseBody(
        z.object({ status: z.enum(["validated", "rejected"]), note: v.text(500) }),
        req.body,
      );
      const item = await Expense.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Dépense introuvable.");
      item.set({ status, decisionNote: note, decidedBy: actor(req), decidedAt: new Date() });
      await item.save();
      res.json({ item });
    }),
  );

  // Paiements du personnel : bulletins validés à régler.
  async function payslipRemaining(slip, excludeId) {
    const pending = await StaffPayment.aggregate([
      {
        $match: {
          payslipId: slip._id,
          status: { $in: ["pending", "approved"] },
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const engaged = pending[0]?.total || 0;
    return { engaged, remaining: Math.max(0, slip.net - slip.paidAmount - engaged) };
  }
  router.get(
    "/payroll-due",
    permit("finance.staffPayments", "view"),
    wrap(async (req, res) => {
      const filter = { status: { $in: ["validated", "partial", "paid"] } };
      if (["teacher", "employee"].includes(req.query.kind)) filter["staff.kind"] = req.query.kind;
      if (/^\d{4}-\d{2}$/.test(req.query.period || "")) filter.period = req.query.period;
      const slips = await Payslip.find(filter).sort({ period: -1, "staff.name": 1 }).limit(500).lean();
      res.json({
        items: await Promise.all(slips.map(async (slip) => ({ ...slip, ...(await payslipRemaining(slip)) }))),
      });
    }),
  );
  crudRoutes(router, {
    path: "/staff-payments",
    model: StaffPayment,
    schema: staffPaymentSchema,
    labels,
    section: "finance.staffPayments",
    search: ["staffName", "reference", "transactionRef"],
    dateField: "date",
    filters: {
      staffKind: (value) => ({ staffKind: value }),
      status: (value) => ({ status: value }),
      period: (value) => ({ period: value }),
      staffId: byId("staffId"),
    },
    sort: { date: -1, createdAt: -1 },
    populate: [["accountId", "name kind"]],
    readOnly: ["payslipId", "reference", "status", "staffId", "staffName", "staffKind", "period"],
    async prepare(data, { req, record }) {
      if (record && record.status !== "pending")
        throw httpError(409, "Ce paiement a déjà été validé : il ne se modifie plus.");
      const slip = await Payslip.findById(record?.payslipId || data.payslipId).lean();
      if (!slip || !["validated", "partial"].includes(slip.status))
        throw httpError(409, "Le bulletin doit être validé par les RH avant le paiement.");
      const { remaining } = await payslipRemaining(slip, record?._id);
      const amount = data.amount ?? record.amount;
      if (amount > remaining)
        throw httpError(400, `Le montant dépasse ce qui reste à payer sur ce bulletin (${money(remaining)}).`);
      if (data.accountId) data.method = (await activeAccount(data.accountId)).kind;
      if (!record)
        Object.assign(data, {
          reference: await nextNumber("SAL"),
          staffId: slip.staffId,
          staffName: slip.staff.name,
          staffKind: slip.staff.kind,
          period: slip.period,
          status: "pending",
          recordedBy: actor(req),
        });
      return data;
    },
    async beforeDelete(record) {
      if (!["pending", "rejected"].includes(record.status))
        throw httpError(409, "Un paiement validé ou versé ne se supprime pas.");
    },
  });
  const staffPaymentStep = (from, to, field) =>
    wrap(async (req, res) => {
      const item = await StaffPayment.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Paiement introuvable.");
      if (!from.includes(item.status))
        throw httpError(409, to === "paid" ? "La direction doit d’abord valider ce paiement." : "Ce paiement a déjà été traité.");
      if (to === "paid") {
        const extra = parseBody(
          z.object({ date: v.day.optional(), transactionRef: v.text(100).optional(), proofUrl: v.url.optional() }),
          req.body || {},
        );
        await activeAccount(item.accountId);
        item.set(Object.fromEntries(Object.entries(extra).filter(([, value]) => value)));
      }
      item.set({ status: to, [`${field}By`]: actor(req), [`${field}At`]: new Date() });
      await item.save();
      if (to === "paid") await refreshPayslip(item.payslipId);
      res.json({ item });
    });
  router.post("/staff-payments/:id/approve", permit("finance.staffPayments", "approve"), staffPaymentStep(["pending"], "approved", "approved"));
  router.post("/staff-payments/:id/reject", permit("finance.staffPayments", "approve"), staffPaymentStep(["pending", "approved"], "rejected", "approved"));
  router.post("/staff-payments/:id/pay", permit("finance.staffPayments", "update"), staffPaymentStep(["approved"], "paid", "paid"));

  // Avances au personnel et soldes restant à payer.
  async function repaidByAdvance() {
    const rows = await Payslip.aggregate([
      { $match: { status: { $ne: "draft" } } },
      { $unwind: "$lines" },
      { $match: { "lines.kind": "advance" } },
      { $group: { _id: "$lines.adjustmentId", total: { $sum: "$lines.amount" } } },
    ]);
    return Object.fromEntries(rows.map((row) => [String(row._id), row.total]));
  }
  router.get(
    "/advances",
    permit("finance.advances", "view"),
    wrap(async (req, res) => {
      const filter = { type: "advance" };
      if (["pending", "approved", "rejected", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
      const [items, repaid] = await Promise.all([
        PayAdjustment.find(filter)
          .populate("staffId", "fullName reference kind")
          .populate("disbursed.accountId", "name kind")
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
        repaidByAdvance(),
      ]);
      res.json({
        items: items.map((item) => {
          const back = repaid[String(item._id)] || 0;
          return { ...item, repaid: back, remaining: item.disbursed?.paid ? Math.max(0, item.amount - back) : 0 };
        }),
      });
    }),
  );
  router.post(
    "/advances",
    permit("finance.advances", "create"),
    wrap(async (req, res) => {
      const data = parseBody(advanceSchema, req.body, labels);
      const item = await PayAdjustment.create({
        ...data,
        type: "advance",
        repaymentStart: data.repaymentStart || data.period,
        status: "pending",
      });
      res.status(201).json({ item });
    }),
  );
  router.post(
    "/advances/:id/disburse",
    permit("finance.advances", "approve"),
    wrap(async (req, res) => {
      const data = parseBody(disburseSchema, req.body, labels);
      const item = await PayAdjustment.findOne({ _id: validId(req.params.id) ? req.params.id : null, type: "advance" });
      if (!item) throw httpError(404, "Avance introuvable.");
      if (item.status !== "approved")
        throw httpError(409, "L’avance doit d’abord être accordée (validée) par les RH ou la direction.");
      if (item.disbursed?.paid) throw httpError(409, "Cette avance a déjà été versée.");
      const account = await activeAccount(data.accountId);
      item.disbursed = {
        paid: true,
        paidAt: disbursedDate(data.date),
        accountId: account._id,
        method: account.kind,
        reference: data.reference,
        by: actor(req),
      };
      await item.save();
      res.json({ item });
    }),
  );
  router.get(
    "/staff-balances",
    permit("finance.advances", "view"),
    wrap(async (_req, res) => {
      const [slips, advances, repaid] = await Promise.all([
        Payslip.find({ status: { $in: ["validated", "partial"] } }).lean(),
        PayAdjustment.find({ type: "advance", "disbursed.paid": true }).populate("staffId", "fullName reference kind").lean(),
        repaidByAdvance(),
      ]);
      const rows = {};
      const row = (id, name, reference, kind) =>
        (rows[String(id)] ||= { staffId: id, name, reference, kind, salaryDue: 0, slips: 0, advanceOutstanding: 0 });
      for (const slip of slips) {
        const entry = row(slip.staffId, slip.staff.name, slip.staff.reference, slip.staff.kind);
        entry.salaryDue += Math.max(0, slip.net - slip.paidAmount);
        entry.slips += 1;
      }
      for (const advance of advances) {
        const left = Math.max(0, advance.amount - (repaid[String(advance._id)] || 0));
        if (!left) continue;
        const entry = row(advance.staffId?._id, advance.staffId?.fullName, advance.staffId?.reference, advance.staffId?.kind);
        entry.advanceOutstanding += left;
      }
      res.json({ items: Object.values(rows).sort((a, b) => (a.name || "").localeCompare(b.name || "")) });
    }),
  );

  // Transferts entre comptes.
  crudRoutes(router, {
    path: "/transfers",
    model: Transfer,
    schema: transferSchema,
    labels,
    section: "finance.transfers",
    only: ["list", "create", "delete"],
    search: ["reference", "transactionRef", "notes"],
    dateField: "date",
    sort: { date: -1, createdAt: -1 },
    populate: [["fromAccountId", "name kind"], ["toAccountId", "name kind"]],
    async prepare(data, { req }) {
      if (data.fromAccountId === data.toAccountId)
        throw httpError(400, "Choisissez deux comptes différents.");
      await activeAccount(data.fromAccountId);
      await activeAccount(data.toAccountId);
      const source = (await accountBalances()).find((item) => String(item._id) === data.fromAccountId);
      if (source && source.balance < data.amount)
        throw httpError(409, `Solde insuffisant sur « ${source.name} » (${money(source.balance)}).`);
      return { ...data, reference: await nextNumber("TRF"), recordedBy: actor(req) };
    },
    async remove(record) {
      if (record.status === "cancelled") throw httpError(409, "Ce transfert est déjà annulé.");
      record.status = "cancelled";
      await record.save();
      return { message: "Transfert annulé : les soldes sont recalculés." };
    },
  });

  const period = (req) => {
    const day = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
    const month = currentMonth();
    return {
      from: day(req.query.from) ? req.query.from : `${month}-01`,
      to: day(req.query.to) ? req.query.to : today(),
    };
  };
  async function withCourseTitles(data) {
    const titles = Object.fromEntries(
      (await Course.find().select("id title").lean()).map((course) => [course.id, course.title]),
    );
    return {
      ...data,
      byCourse: Object.entries(data.byCourse)
        .map(([id, amount]) => ({ id, title: titles[id] || (id === "autre" ? "Sans formation" : id), amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }
  router.get("/dashboard", permit("finance.dashboard", "view"), wrap(async (req, res) => {
    const [data, students] = await Promise.all([financeDashboard(period(req)), studentPaymentCounts()]);
    res.json({ ...(await withCourseTitles(data)), students });
  }));
  router.get("/reports", permit("finance.reports", "view"), wrap(async (req, res) => {
    res.json(await withCourseTitles(await financeDashboard(period(req))));
  }));
  router.get("/settings", permit("finance.settings", "view"), wrap(async (_req, res) => {
    res.json({ settings: await getSettings("finance") });
  }));
  router.put("/settings", permit("finance.settings", "update"), wrap(async (req, res) => {
    const result = await saveSettings("finance", req.body, req.admin);
    if (result.error) throw httpError(400, result.error);
    res.json(result);
  }));
  return router;
}
