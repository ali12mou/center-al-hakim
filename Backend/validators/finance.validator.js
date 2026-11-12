import { z } from "zod";
import { v } from "../services/crud.js";
import { PAYMENT_METHODS } from "../models/hr.models.js";
import { FEE_TYPES } from "../models/finance.models.js";

// Fiche student saisie depuis Finances › Liste des students.
export const studentSchema = z.object({
  // Inscrit choisi dans Gestion du centre › Inscrits (sinon : nouvelle fiche).
  registrationId: v.optionalId,
  photoUrl: v.url,
  name: z.string().trim().min(2).max(100),
  courseId: v.required(80),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+\d\s().-]+$/, "numéro non valide"),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  enrolledOn: v.optionalDay,
  username: z
    .string()
    .trim()
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]*$/, "lettres, chiffres, point, tiret ou soulignement")
    .default(""),
  password: z.union([z.string().min(8, "8 caractères minimum").max(128), z.literal("")]).optional(),
  profile: z.enum(["apprenant", "professionnel", "entreprise"]).default("apprenant"),
  status: z.enum(["new", "contacted", "confirmed", "closed"]).default("confirmed"),
});
// Encaissement simple : formation → student → frais → montant → mode.
export const collectionSchema = z.object({
  courseId: v.required(80),
  registrationId: v.id,
  feeId: v.optionalId,
  amount: v.positive,
  method: z.enum(PAYMENT_METHODS),
  date: v.optionalDay,
  notes: v.text(1000),
});

export const accountSchema = z.object({
  name: v.required(100),
  kind: z.enum(PAYMENT_METHODS),
  number: v.text(100),
  holder: v.text(150),
  bankName: v.text(100),
  openingBalance: z.coerce.number().int().min(-1_000_000_000).max(1_000_000_000).default(0),
  openingDate: v.optionalDay,
  active: z.boolean().default(true),
  notes: v.text(1000),
});
export const feeSchema = z.object({
  courseId: v.required(80),
  // Nom affiché du frais : calculé par le serveur (type – formation).
  label: v.text(150).optional(),
  feeType: z.enum(FEE_TYPES).default("training"),
  schoolYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Année scolaire au format 2025-2026.")
    .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, "L’année scolaire couvre deux années consécutives.")
    .optional(),
  amount: v.money,
  registrationFee: v.money,
  durationMonths: z.coerce.number().int().min(1).max(60).default(1),
  active: z.boolean().default(true),
  notes: v.text(1000),
});
// Un pourcentage ne dépasse pas 100 : vérifié à l’enregistrement (finance.routes).
export const discountSchema = z.object({
  name: v.required(120),
  kind: z.enum(["percent", "fixed"]).default("percent"),
  value: z.coerce.number().min(0).max(1_000_000_000),
  description: v.text(500),
  active: z.boolean().default(true),
});
const installment = z.object({
  label: v.text(80),
  dueDate: v.day,
  amount: v.positive,
});
export const studentAccountSchema = z.object({
  registrationId: v.optionalId,
  studentName: v.required(120),
  phone: v.text(30),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  courseId: v.text(80),
  feeId: v.optionalId,
  baseAmount: v.money,
  registrationFee: v.money,
  discountId: v.optionalId,
  manualDiscount: v.money,
  discountReason: v.text(200),
  payer: z
    .object({
      type: z.enum(["student", "organisation"]).default("student"),
      name: v.text(150),
      contact: v.text(200),
    })
    .default({ type: "student", name: "", contact: "" }),
  plan: z.enum(["full", "monthly", "installments", "custom"]).default("full"),
  count: z.coerce.number().int().min(1).max(60).default(1),
  startDate: v.day,
  installments: z.array(installment).max(60).default([]),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  notes: v.text(2000),
  reason: v.text(300),
});
// La méthode est déduite du compte choisi (voir finance.routes).
const split = z.object({
  method: z.enum(PAYMENT_METHODS).optional(),
  accountId: v.id,
  amount: v.positive,
  transactionRef: v.text(100),
});
export const paymentSchema = z.object({
  studentAccountId: v.id,
  invoiceId: v.optionalId,
  date: v.day,
  splits: z.array(split).min(1).max(6),
  proofUrl: v.url,
  notes: v.text(1000),
});
export const paymentUpdateSchema = z.object({
  proofUrl: v.url,
  notes: v.text(1000),
});
const invoiceLine = z.object({
  label: v.required(200),
  quantity: z.coerce.number().min(0).max(10_000).default(1),
  unitPrice: v.money,
});
export const invoiceSchema = z.object({
  studentAccountId: v.id,
  billTo: z
    .object({
      kind: z.enum(["student", "organisation"]).default("student"),
      name: v.text(150),
      address: v.text(300),
      contact: v.text(200),
    })
    .optional(),
  issueDate: v.day,
  dueDate: v.optionalDay,
  lines: z.array(invoiceLine).max(40).default([]),
  discount: v.money,
  notes: v.text(1000),
  reason: v.text(300),
});
export const categorySchema = z.object({
  name: v.required(80),
  description: v.text(300),
  requiresProof: z.boolean().default(false),
  active: z.boolean().default(true),
});
export const expenseSchema = z.object({
  date: v.day,
  beneficiary: v.required(150),
  description: v.text(1000),
  amount: v.positive,
  categoryId: v.id,
  accountId: v.id,
  method: z.enum(PAYMENT_METHODS).default("cash"),
  transactionRef: v.text(100),
  proofUrl: v.url,
});
export const staffPaymentSchema = z.object({
  payslipId: v.id,
  amount: v.positive,
  date: v.day,
  accountId: v.id,
  method: z.enum(PAYMENT_METHODS).default("cash"),
  transactionRef: v.text(100),
  proofUrl: v.url,
  notes: v.text(1000),
});
export const transferSchema = z.object({
  date: v.day,
  fromAccountId: v.id,
  toAccountId: v.id,
  amount: v.positive,
  transactionRef: v.text(100),
  notes: v.text(500),
});
export const advanceSchema = z.object({
  staffId: v.id,
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
export const disburseSchema = z.object({
  date: v.day,
  accountId: v.id,
  method: z.enum(PAYMENT_METHODS).default("cash"),
  reference: v.text(100),
});
export const labels = {
  name: "Nom",
  kind: "Type",
  courseId: "Formation",
  label: "Nom",
  amount: "Montant",
  value: "Valeur",
  studentName: "Nom du student",
  studentAccountId: "Dossier du student",
  startDate: "Date de début",
  installments: "Échéances",
  date: "Date",
  splits: "Moyens de paiement",
  issueDate: "Date d’émission",
  lines: "Lignes",
  beneficiary: "Bénéficiaire",
  categoryId: "Catégorie",
  accountId: "Compte",
  payslipId: "Bulletin",
  fromAccountId: "Compte source",
  toAccountId: "Compte destinataire",
  staffId: "Personne",
  period: "Mois",
  email: "E-mail",
  feeType: "Type de frais",
  schoolYear: "Année scolaire",
  registrationId: "Student",
  feeId: "Frais lié",
  method: "Mode de paiement",
  phone: "Téléphone",
  username: "Nom d’utilisateur",
  password: "Mot de passe",
  photoUrl: "Photo",
  enrolledOn: "Date",
};
