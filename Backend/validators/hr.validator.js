import { z } from "zod";
import { v } from "../services/crud.js";
import {
  LEAVE_TYPES,
  PAY_TYPES,
  PAYMENT_METHODS,
  SHIFTS,
} from "../models/hr.models.js";

const email = z
  .union([z.string().trim().email().max(254), z.literal("")])
  .default("");
export const payFields = [
  "payType",
  "monthlySalary",
  "hourlyRate",
  "flatAmount",
  "paymentMethod",
  "paymentAccount",
];
const pay = {
  payType: z.enum(PAY_TYPES).default("monthly"),
  monthlySalary: v.money,
  hourlyRate: v.money,
  flatAmount: v.money,
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  paymentAccount: v.text(100),
};
export const ratesSchema = z.object(pay);
export const staffSchema = z.object({
  kind: z.enum(["teacher", "employee"]),
  firstName: v.required(80),
  lastName: v.required(80),
  gender: z.enum(["", "F", "M"]).default(""),
  birthDate: v.optionalDay,
  nationalId: v.text(50),
  phone: v.text(30),
  email,
  address: v.text(300),
  position: v.text(100),
  department: v.text(100),
  specialty: v.text(150),
  subjects: v.lines,
  classes: v.lines,
  availability: v.text(300),
  hireDate: v.optionalDay,
  status: z.enum(["active", "inactive", "left"]).default("active"),
  ...pay,
  emergencyContact: v.text(200),
  photoUrl: v.url,
  notes: v.text(2000),
});
export const documentSchema = z.object({
  name: v.required(150),
  kind: z
    .enum(["cv", "diplome", "identite", "contrat", "attestation", "autre"])
    .default("autre"),
  url: v.url.refine(Boolean, "obligatoire"),
  expiresAt: v.optionalDay,
});
export const contractSchema = z
  .object({
    staffId: v.id,
    type: z.enum(["cdi", "cdd", "vacation", "prestation", "stage"]).default("cdd"),
    position: v.text(100),
    startDate: v.day,
    endDate: v.optionalDay,
    payType: z.enum(PAY_TYPES).default("monthly"),
    amount: v.money,
    hoursPerWeek: z.coerce.number().min(0).max(80).default(0),
    status: z.enum(["draft", "active", "ended", "terminated"]).default("active"),
    documentUrl: v.url,
    notes: v.text(2000),
  });
export const assignmentSchema = z.object({
  staffId: v.id,
  kind: z.enum(["course", "post"]).default("course"),
  label: v.required(120),
  courseId: v.text(80),
  room: v.text(60),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
  shift: z.enum(SHIFTS).default("matin"),
  startTime: v.time,
  endTime: v.time,
  startDate: v.day,
  endDate: v.optionalDay,
  active: z.boolean().default(true),
  notes: v.text(1000),
});
export const planningSchema = z.object({
  staffId: v.id,
  date: v.day,
  shift: z.enum(SHIFTS).default("matin"),
  startTime: v.time,
  endTime: v.time,
  label: v.text(120),
  courseId: v.text(80),
  room: v.text(60),
  status: z.enum(["planned", "done", "cancelled", "replaced"]).default("planned"),
  replacementStaffId: v.optionalId,
  notes: v.text(500),
});
export const attendanceSchema = z.object({
  staffId: v.id,
  date: v.day,
  shift: z.enum(SHIFTS).default("matin"),
  startTime: v.optionalTime,
  endTime: v.optionalTime,
  hours: z
    .union([z.coerce.number().min(0).max(24), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === null ? undefined : value)),
  classLabel: v.text(120),
  status: z.enum(["present", "late", "absent", "excused", "leave"]).default("present"),
  lateMinutes: z.coerce.number().int().min(0).max(600).default(0),
  replacementStaffId: v.optionalId,
  notes: v.text(500),
});
export const leaveSchema = z.object({
  staffId: v.id,
  type: z.enum(LEAVE_TYPES).default("annual"),
  startDate: v.day,
  endDate: v.day,
  days: z
    .union([z.coerce.number().min(0).max(366), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === null ? undefined : value)),
  reason: v.text(1000),
  replacementStaffId: v.optionalId,
  documentUrl: v.url,
});
export const adjustmentSchema = z.object({
  staffId: v.id,
  type: z.enum(["bonus", "deduction", "advance"]),
  label: v.text(150),
  amount: v.positive,
  period: v.month,
  repaymentMonths: z.coerce.number().int().min(1).max(12).default(1),
  repaymentStart: z
    .union([v.month, z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  notes: v.text(1000),
});
export const labels = {
  kind: "Type",
  firstName: "Prénom",
  lastName: "Nom",
  birthDate: "Date de naissance",
  email: "E-mail",
  hireDate: "Date d’embauche",
  staffId: "Personne",
  startDate: "Date de début",
  endDate: "Date de fin",
  startTime: "Heure de début",
  endTime: "Heure de fin",
  weekdays: "Jours de la semaine",
  label: "Description",
  date: "Date",
  amount: "Montant",
  period: "Mois",
  repaymentStart: "Début du remboursement",
  hours: "Heures",
  name: "Nom du document",
  url: "Fichier",
};
