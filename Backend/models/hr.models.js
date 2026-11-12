import mongoose from "mongoose";

const options = { timestamps: true };
const text = { type: String, trim: true };
const ref = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});
// Dates « AAAA-MM-JJ » et mois « AAAA-MM » : pas de décalage de fuseau.
const day = { ...text, match: /^\d{4}-\d{2}-\d{2}$/ };
const month = { ...text, match: /^\d{4}-\d{2}$/ };
const time = { ...text, match: /^\d{2}:\d{2}$/ };
const money = { type: Number, min: 0, default: 0 };
export const SHIFTS = ["matin", "apres-midi", "soir", "journee"];
export const PAY_TYPES = ["monthly", "hourly", "flat"];
export const PAYMENT_METHODS = [
  "cash",
  "bank",
  "dmoney",
  "waafi",
  "cacpay",
  "sabapay",
];
const actor = {
  id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  name: { ...text, default: "" },
};

const documentSchema = new mongoose.Schema(
  {
    name: { ...text, required: true, maxlength: 150 },
    kind: {
      type: String,
      enum: ["cv", "diplome", "identite", "contrat", "attestation", "autre"],
      default: "autre",
    },
    url: { ...text, required: true },
    expiresAt: { ...day, default: undefined },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const staffSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    kind: { type: String, enum: ["teacher", "employee"], required: true },
    firstName: { ...text, required: true, maxlength: 80 },
    lastName: { ...text, required: true, maxlength: 80 },
    fullName: { ...text, default: "" },
    gender: { type: String, enum: ["", "F", "M"], default: "" },
    birthDate: { ...day, default: undefined },
    nationalId: { ...text, maxlength: 50, default: "" },
    phone: { ...text, maxlength: 30, default: "" },
    email: { ...text, lowercase: true, maxlength: 254, default: "" },
    address: { ...text, maxlength: 300, default: "" },
    position: { ...text, maxlength: 100, default: "" },
    department: { ...text, maxlength: 100, default: "" },
    specialty: { ...text, maxlength: 150, default: "" },
    subjects: { type: [String], default: [] },
    classes: { type: [String], default: [] },
    availability: { ...text, maxlength: 300, default: "" },
    hireDate: { ...day, default: undefined },
    status: {
      type: String,
      enum: ["active", "inactive", "left"],
      default: "active",
    },
    payType: { type: String, enum: PAY_TYPES, default: "monthly" },
    monthlySalary: money,
    hourlyRate: money,
    flatAmount: money,
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentAccount: { ...text, maxlength: 100, default: "" },
    emergencyContact: { ...text, maxlength: 200, default: "" },
    photoUrl: { ...text, default: "" },
    notes: { ...text, maxlength: 2000, default: "" },
    documents: { type: [documentSchema], default: [] },
  },
  options,
);
staffSchema.pre("validate", function setFullName(next) {
  this.fullName = `${this.firstName || ""} ${this.lastName || ""}`.trim();
  next();
});
staffSchema.index({ kind: 1, status: 1, fullName: 1 });

const contractSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    staffId: ref("Staff"),
    type: {
      type: String,
      enum: ["cdi", "cdd", "vacation", "prestation", "stage"],
      default: "cdd",
    },
    position: { ...text, maxlength: 100, default: "" },
    startDate: { ...day, required: true },
    endDate: { ...day, default: undefined },
    payType: { type: String, enum: PAY_TYPES, default: "monthly" },
    amount: money,
    hoursPerWeek: { type: Number, min: 0, max: 80, default: 0 },
    status: {
      type: String,
      enum: ["draft", "active", "ended", "terminated"],
      default: "active",
    },
    documentUrl: { ...text, default: "" },
    notes: { ...text, maxlength: 2000, default: "" },
  },
  options,
);
contractSchema.index({ staffId: 1, startDate: -1 });

// Affectation récurrente : cours d’un enseignant ou poste d’un employé.
const assignmentSchema = new mongoose.Schema(
  {
    staffId: ref("Staff"),
    kind: { type: String, enum: ["course", "post"], default: "course" },
    label: { ...text, required: true, maxlength: 120 },
    courseId: { ...text, default: "" },
    room: { ...text, maxlength: 60, default: "" },
    weekdays: { type: [Number], default: [] },
    shift: { type: String, enum: SHIFTS, default: "matin" },
    startTime: { ...time, required: true },
    endTime: { ...time, required: true },
    startDate: { ...day, required: true },
    endDate: { ...day, default: undefined },
    active: { type: Boolean, default: true },
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
assignmentSchema.index({ staffId: 1, active: 1 });

const planningSchema = new mongoose.Schema(
  {
    staffId: ref("Staff"),
    assignmentId: ref("Assignment", false),
    date: { ...day, required: true },
    shift: { type: String, enum: SHIFTS, default: "matin" },
    startTime: { ...time, required: true },
    endTime: { ...time, required: true },
    label: { ...text, maxlength: 120, default: "" },
    courseId: { ...text, default: "" },
    room: { ...text, maxlength: 60, default: "" },
    status: {
      type: String,
      enum: ["planned", "done", "cancelled", "replaced"],
      default: "planned",
    },
    replacementStaffId: ref("Staff", false),
    notes: { ...text, maxlength: 500, default: "" },
  },
  options,
);
planningSchema.index({ date: 1, staffId: 1 });
// Générer deux fois le même mois ne crée pas de doublon.
planningSchema.index(
  { assignmentId: 1, date: 1 },
  { unique: true, partialFilterExpression: { assignmentId: { $exists: true } } },
);

const attendanceSchema = new mongoose.Schema(
  {
    staffId: ref("Staff"),
    planningId: ref("PlanningEntry", false),
    date: { ...day, required: true },
    shift: { type: String, enum: SHIFTS, default: "matin" },
    startTime: { ...time, default: undefined },
    endTime: { ...time, default: undefined },
    hours: { type: Number, min: 0, max: 24, default: 0 },
    classLabel: { ...text, maxlength: 120, default: "" },
    status: {
      type: String,
      enum: ["present", "late", "absent", "excused", "leave"],
      default: "present",
    },
    lateMinutes: { type: Number, min: 0, max: 600, default: 0 },
    replacementStaffId: ref("Staff", false),
    validated: { type: Boolean, default: false },
    validatedBy: actor,
    validatedAt: Date,
    notes: { ...text, maxlength: 500, default: "" },
  },
  options,
);
attendanceSchema.index({ staffId: 1, date: -1 });
attendanceSchema.index(
  { planningId: 1 },
  { unique: true, partialFilterExpression: { planningId: { $exists: true } } },
);

export const LEAVE_TYPES = [
  "annual",
  "sick",
  "unpaid",
  "exceptional",
  "maternity",
  "absence_justified",
  "absence_unjustified",
];
const leaveSchema = new mongoose.Schema(
  {
    staffId: ref("Staff"),
    type: { type: String, enum: LEAVE_TYPES, default: "annual" },
    startDate: { ...day, required: true },
    endDate: { ...day, required: true },
    days: { type: Number, min: 0, max: 366, default: 1 },
    reason: { ...text, maxlength: 1000, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    replacementStaffId: ref("Staff", false),
    documentUrl: { ...text, default: "" },
    decidedBy: actor,
    decidedAt: Date,
  },
  options,
);
leaveSchema.index({ staffId: 1, startDate: -1 });

// Prime, retenue ou avance. Une avance est remboursée sur `repaymentMonths`
// mois à partir de `repaymentStart`, une fois versée par les finances.
const adjustmentSchema = new mongoose.Schema(
  {
    staffId: ref("Staff"),
    type: {
      type: String,
      enum: ["bonus", "deduction", "advance"],
      required: true,
    },
    label: { ...text, maxlength: 150, default: "" },
    amount: { type: Number, min: 1, required: true },
    period: { ...month, required: true },
    repaymentMonths: { type: Number, min: 1, max: 12, default: 1 },
    repaymentStart: { ...month, default: undefined },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    decidedBy: actor,
    decidedAt: Date,
    disbursed: {
      paid: { type: Boolean, default: false },
      paidAt: Date,
      accountId: ref("FinanceAccount", false),
      method: { type: String, enum: PAYMENT_METHODS, default: undefined },
      reference: { ...text, default: "" },
      by: actor,
    },
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
adjustmentSchema.index({ staffId: 1, period: -1 });

const payLineSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["base", "bonus", "deduction", "advance", "absence"],
      required: true,
    },
    label: { ...text, required: true },
    amount: { type: Number, min: 0, required: true },
    adjustmentId: ref("PayAdjustment", false),
  },
  { _id: false },
);
const payslipSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    staffId: ref("Staff"),
    period: { ...month, required: true },
    staff: {
      name: { ...text, default: "" },
      reference: { ...text, default: "" },
      kind: { ...text, default: "" },
      position: { ...text, default: "" },
    },
    payType: { type: String, enum: PAY_TYPES, required: true },
    hours: { type: Number, min: 0, default: 0 },
    hourlyRate: money,
    lines: { type: [payLineSchema], default: [] },
    gross: money,
    totalDeductions: money,
    net: money,
    paidAmount: money,
    status: {
      type: String,
      enum: ["draft", "validated", "partial", "paid"],
      default: "draft",
    },
    validatedBy: actor,
    validatedAt: Date,
    notes: { ...text, maxlength: 1000, default: "" },
  },
  options,
);
payslipSchema.index({ staffId: 1, period: 1 }, { unique: true });
payslipSchema.index({ period: -1, status: 1 });

export const Staff = mongoose.model("Staff", staffSchema, "hr_staff");
export const Contract = mongoose.model("Contract", contractSchema, "hr_contracts");
export const Assignment = mongoose.model(
  "Assignment",
  assignmentSchema,
  "hr_assignments",
);
export const PlanningEntry = mongoose.model(
  "PlanningEntry",
  planningSchema,
  "hr_planning",
);
export const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema,
  "hr_attendance",
);
export const Leave = mongoose.model("Leave", leaveSchema, "hr_leaves");
export const PayAdjustment = mongoose.model(
  "PayAdjustment",
  adjustmentSchema,
  "hr_adjustments",
);
export const Payslip = mongoose.model("Payslip", payslipSchema, "hr_payslips");

export const hrModels = [
  Staff,
  Contract,
  Assignment,
  PlanningEntry,
  Attendance,
  Leave,
  PayAdjustment,
  Payslip,
];
