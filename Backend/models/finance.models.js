import mongoose from "mongoose";
import { PAYMENT_METHODS } from "./hr.models.js";

const options = { timestamps: true };
const text = { type: String, trim: true };
const ref = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});
const day = { ...text, match: /^\d{4}-\d{2}-\d{2}$/ };
const month = { ...text, match: /^\d{4}-\d{2}$/ };
const money = { type: Number, min: 0, default: 0 };
const actor = {
  id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  name: { ...text, default: "" },
};
// Toute modification d’un dossier, d’une facture ou d’un paiement est tracée.
const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { ...text, default: "" },
    action: { ...text, required: true },
    detail: { ...text, maxlength: 1000, default: "" },
  },
  { _id: false },
);
export const ACCOUNT_KINDS = PAYMENT_METHODS;

const accountSchema = new mongoose.Schema(
  {
    name: { ...text, required: true, maxlength: 100 },
    kind: { type: String, enum: ACCOUNT_KINDS, required: true },
    number: { ...text, maxlength: 100, default: "" },
    holder: { ...text, maxlength: 150, default: "" },
    bankName: { ...text, maxlength: 100, default: "" },
    openingBalance: { type: Number, default: 0 },
    openingDate: { ...day, default: undefined },
    active: { type: Boolean, default: true },
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);

// Nature d’un frais : un « frais mensuel » est un montant par mois.
export const FEE_TYPES = ["monthly", "registration", "training", "exam", "certificate", "other"];
const feeSchema = new mongoose.Schema(
  {
    courseId: { ...text, required: true },
    label: { ...text, required: true, maxlength: 150 },
    feeType: { type: String, enum: FEE_TYPES, default: "training" },
    schoolYear: { ...text, match: /^\d{4}-\d{4}$/, default: undefined },
    amount: { type: Number, min: 0, required: true },
    registrationFee: money,
    durationMonths: { type: Number, min: 1, max: 60, default: 1 },
    active: { type: Boolean, default: true },
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
feeSchema.index({ courseId: 1, active: 1 });

const discountSchema = new mongoose.Schema(
  {
    name: { ...text, required: true, maxlength: 120 },
    kind: { type: String, enum: ["percent", "fixed"], default: "percent" },
    value: { type: Number, min: 0, required: true },
    description: { ...text, maxlength: 500, default: "" },
    active: { type: Boolean, default: true },
  },
  options,
);

const installmentSchema = new mongoose.Schema(
  {
    label: { ...text, maxlength: 80, default: "" },
    dueDate: { ...day, required: true },
    amount: { type: Number, min: 0, required: true },
  },
  { _id: true },
);
// Dossier financier d’un student pour une formation.
const studentAccountSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    registrationId: ref("Registration", false),
    studentName: { ...text, required: true, maxlength: 120 },
    phone: { ...text, maxlength: 30, default: "" },
    email: { ...text, lowercase: true, maxlength: 254, default: "" },
    courseId: { ...text, default: "" },
    courseTitle: { ...text, default: "" },
    feeId: ref("FeeRate", false),
    baseAmount: money,
    registrationFee: money,
    discountId: ref("Discount", false),
    discountLabel: { ...text, default: "" },
    // Remise accordée au cas par cas, en plus d’une remise du catalogue.
    manualDiscount: money,
    discountReason: { ...text, maxlength: 200, default: "" },
    discountAmount: money,
    totalAmount: money,
    paidAmount: money,
    payer: {
      type: { type: String, enum: ["student", "organisation"], default: "student" },
      name: { ...text, maxlength: 150, default: "" },
      contact: { ...text, maxlength: 200, default: "" },
    },
    plan: {
      type: String,
      enum: ["full", "monthly", "installments", "custom"],
      default: "full",
    },
    installments: { type: [installmentSchema], default: [] },
    startDate: { ...day, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    history: { type: [historySchema], default: [] },
    notes: { ...text, maxlength: 2000, default: "" },
  },
  options,
);
studentAccountSchema.index({ status: 1, createdAt: -1 });
studentAccountSchema.index({ studentName: 1 });

const splitSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    accountId: ref("FinanceAccount"),
    amount: { type: Number, min: 1, required: true },
    transactionRef: { ...text, maxlength: 100, default: "" },
  },
  { _id: false },
);
const paymentSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    receiptNumber: { ...text, required: true, unique: true },
    studentAccountId: ref("StudentAccount"),
    invoiceId: ref("Invoice", false),
    studentName: { ...text, default: "" },
    courseId: { ...text, default: "" },
    date: { ...day, required: true },
    amount: { type: Number, min: 1, required: true },
    splits: { type: [splitSchema], default: [] },
    mode: { type: String, enum: ["manual", "automatic"], default: "manual" },
    status: {
      type: String,
      enum: ["confirmed", "pending", "cancelled"],
      default: "confirmed",
    },
    proofUrl: { ...text, default: "" },
    notes: { ...text, maxlength: 1000, default: "" },
    recordedBy: actor,
    cancelReason: { ...text, maxlength: 500, default: "" },
    cancelledBy: actor,
    cancelledAt: Date,
  },
  options,
);
paymentSchema.index({ studentAccountId: 1, date: 1 });
paymentSchema.index({ date: -1, status: 1 });

const invoiceLineSchema = new mongoose.Schema(
  {
    label: { ...text, required: true, maxlength: 200 },
    quantity: { type: Number, min: 0, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);
const invoiceSchema = new mongoose.Schema(
  {
    number: { ...text, required: true, unique: true },
    studentAccountId: ref("StudentAccount"),
    billTo: {
      kind: { type: String, enum: ["student", "organisation"], default: "student" },
      name: { ...text, required: true, maxlength: 150 },
      address: { ...text, maxlength: 300, default: "" },
      contact: { ...text, maxlength: 200, default: "" },
    },
    issueDate: { ...day, required: true },
    dueDate: { ...day, default: undefined },
    lines: { type: [invoiceLineSchema], default: [] },
    subtotal: money,
    discount: money,
    total: money,
    status: { type: String, enum: ["issued", "cancelled"], default: "issued" },
    cancelReason: { ...text, maxlength: 500, default: "" },
    history: { type: [historySchema], default: [] },
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
invoiceSchema.index({ studentAccountId: 1, issueDate: 1 });

const categorySchema = new mongoose.Schema(
  {
    name: { ...text, required: true, unique: true, maxlength: 80 },
    description: { ...text, maxlength: 300, default: "" },
    requiresProof: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  options,
);
const expenseSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    date: { ...day, required: true },
    beneficiary: { ...text, required: true, maxlength: 150 },
    description: { ...text, maxlength: 1000, default: "" },
    amount: { type: Number, min: 1, required: true },
    categoryId: ref("ExpenseCategory"),
    categoryName: { ...text, default: "" },
    accountId: ref("FinanceAccount"),
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    transactionRef: { ...text, maxlength: 100, default: "" },
    proofUrl: { ...text, default: "" },
    // pending : au-dessus du seuil, en attente de validation ; validated : payée.
    status: {
      type: String,
      enum: ["pending", "validated", "rejected"],
      default: "validated",
    },
    recordedBy: actor,
    decidedBy: actor,
    decidedAt: Date,
    decisionNote: { ...text, maxlength: 500, default: "" },
  },
  options,
);
expenseSchema.index({ date: -1, status: 1 });

// Paiement d’un bulletin (salaire ou rémunération d’enseignant).
// pending → approved (direction) → paid (décaissement).
const staffPaymentSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    payslipId: ref("Payslip"),
    staffId: ref("Staff"),
    staffName: { ...text, default: "" },
    staffKind: { type: String, enum: ["teacher", "employee"], required: true },
    period: { ...month, required: true },
    amount: { type: Number, min: 1, required: true },
    date: { ...day, required: true },
    accountId: ref("FinanceAccount"),
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    transactionRef: { ...text, maxlength: 100, default: "" },
    proofUrl: { ...text, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
    },
    recordedBy: actor,
    approvedBy: actor,
    approvedAt: Date,
    paidBy: actor,
    paidAt: Date,
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
staffPaymentSchema.index({ period: -1, staffKind: 1, status: 1 });

const transferSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    date: { ...day, required: true },
    fromAccountId: ref("FinanceAccount"),
    toAccountId: ref("FinanceAccount"),
    amount: { type: Number, min: 1, required: true },
    transactionRef: { ...text, maxlength: 100, default: "" },
    notes: { ...text, maxlength: 500, default: "" },
    status: { type: String, enum: ["done", "cancelled"], default: "done" },
    recordedBy: actor,
  },
  options,
);

export const FinanceAccount = mongoose.model(
  "FinanceAccount",
  accountSchema,
  "fin_accounts",
);
export const FeeRate = mongoose.model("FeeRate", feeSchema, "fin_fees");
export const Discount = mongoose.model("Discount", discountSchema, "fin_discounts");
export const StudentAccount = mongoose.model(
  "StudentAccount",
  studentAccountSchema,
  "fin_student_accounts",
);
export const Payment = mongoose.model("Payment", paymentSchema, "fin_payments");
export const Invoice = mongoose.model("Invoice", invoiceSchema, "fin_invoices");
export const ExpenseCategory = mongoose.model(
  "ExpenseCategory",
  categorySchema,
  "fin_expense_categories",
);
export const Expense = mongoose.model("Expense", expenseSchema, "fin_expenses");
export const StaffPayment = mongoose.model(
  "StaffPayment",
  staffPaymentSchema,
  "fin_staff_payments",
);
export const Transfer = mongoose.model("Transfer", transferSchema, "fin_transfers");

export const financeModels = [
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
];
