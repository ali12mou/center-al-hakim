import { z } from "zod";
import { ModuleSetting } from "../models/system.models.js";
import { PAYMENT_METHODS } from "../models/hr.models.js";

const time = z.string().regex(/^\d{2}:\d{2}$/);
const shift = z
  .object({ label: z.string().trim().min(1).max(40), start: time, end: time })
  .strict();
const schemas = {
  hr: z
    .object({
      shifts: z
        .object({
          matin: shift,
          "apres-midi": shift,
          soir: shift,
          journee: shift,
        })
        .strict(),
      lateToleranceMinutes: z.coerce.number().int().min(0).max(120),
      workingDaysPerMonth: z.coerce.number().int().min(1).max(31),
      annualLeaveDays: z.coerce.number().int().min(0).max(60),
      defaultHourlyRate: z.coerce.number().int().min(0).max(1_000_000),
      deductAbsences: z.boolean(),
      // Jours non travaillés (0 = dimanche … 6 = samedi), exclus des congés.
      weekend: z.array(z.number().int().min(0).max(6)).max(3),
      payday: z.coerce.number().int().min(1).max(31),
    })
    .strict(),
  finance: z
    .object({
      currency: z.string().trim().min(1).max(10),
      centreName: z.string().trim().min(2).max(120),
      centreAddress: z.string().trim().max(300),
      centrePhone: z.string().trim().max(60),
      centreEmail: z.string().trim().max(254),
      taxId: z.string().trim().max(60),
      invoiceDueDays: z.coerce.number().int().min(0).max(120),
      expenseApprovalThreshold: z.coerce.number().int().min(0).max(1_000_000_000),
      paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
      invoiceFooter: z.string().trim().max(500),
    })
    .strict(),
};
export const defaults = {
  hr: {
    shifts: {
      matin: { label: "Matin", start: "07:30", end: "12:30" },
      "apres-midi": { label: "Après-midi", start: "13:00", end: "17:00" },
      soir: { label: "Soir / nuit", start: "17:30", end: "21:30" },
      journee: { label: "Journée", start: "08:00", end: "17:00" },
    },
    lateToleranceMinutes: 10,
    workingDaysPerMonth: 26,
    annualLeaveDays: 30,
    defaultHourlyRate: 2000,
    deductAbsences: true,
    weekend: [5],
    payday: 28,
  },
  finance: {
    currency: "FDJ",
    centreName: "AL-HAKIM CENTER",
    centreAddress: "Djibouti",
    centrePhone: "+253 77 70 34 36",
    centreEmail: "",
    taxId: "",
    invoiceDueDays: 15,
    expenseApprovalThreshold: 50000,
    paymentMethods: [...PAYMENT_METHODS],
    invoiceFooter: "Merci pour votre confiance. Conservez ce document.",
  },
};

export async function getSettings(module) {
  const stored = await ModuleSetting.findById(module).lean();
  const data = { ...defaults[module], ...(stored?.data || {}) };
  if (module === "hr")
    data.shifts = { ...defaults.hr.shifts, ...(stored?.data?.shifts || {}) };
  return data;
}
export async function saveSettings(module, body, user) {
  const parsed = schemas[module].safeParse({
    ...(await getSettings(module)),
    ...body,
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")} : ${issue.message}`)
        .join(" · "),
    };
  await ModuleSetting.updateOne(
    { _id: module },
    { $set: { data: parsed.data, updatedBy: user?.name || "" } },
    { upsert: true },
  );
  return { settings: parsed.data };
}
