import { z } from "zod";

export const password = z
  .string()
  .min(12, "Utilisez au moins 12 caractères.")
  .max(128);
export const loginSchema = z
  .object({
    username: z.string().trim().min(3).max(50),
    password: z.string().min(1).max(128),
  })
  .strict();
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(1).max(128),
  })
  .strict();
export const setupSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    username: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    email: z.string().trim().email().max(254),
    password,
  })
  .strict();

const safeUrl = z
  .string()
  .max(1000)
  .default("")
  .refine(
    (value) => !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
    "Utilisez une URL http, https ou un chemin local.",
  );
const contentFields = {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(""),
  body: z.string().max(15000).default(""),
  published: z.boolean().default(false),
  imageUrl: safeUrl,
};
const strings = z.array(z.string().trim().min(1).max(500)).max(30).default([]);
export const contentSchemas = {
  competences: z
    .object({
      ...contentFields,
      category: z.string().max(80).default("informatique"),
      icon: z.string().max(50).default("GraduationCap"),
    })
    .strict(),
  informations: z
    .object({
      ...contentFields,
      category: z.string().max(80).default("Centre"),
    })
    .strict(),
  blog: z
    .object({
      ...contentFields,
      author: z.string().max(100).default("AL-HAKIM CENTER"),
      category: z.string().max(80).default("Actualités"),
    })
    .strict(),
  businesses: z
    .object({
      ...contentFields,
      benefits: strings,
      audience: z.string().max(200).default("Entreprises et institutions"),
    })
    .strict(),
  certifications: z
    .object({
      ...contentFields,
      issuer: z.string().max(150).default("AL-HAKIM CENTER"),
      requirements: strings,
      accreditation: z
        .string()
        .max(300)
        .default("Attestation du centre — modalités à confirmer"),
    })
    .strict(),
  assessments: z
    .object({
      ...contentFields,
      skill: z.string().max(100).default("Informatique"),
      questions: z
        .array(
          z
            .object({
              prompt: z.string().trim().min(5).max(500),
              choices: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
              correctIndex: z.number().int().min(0).max(5),
            })
            .strict()
            .refine(
              (question) => question.correctIndex < question.choices.length,
              "Choisissez une réponse existante.",
            ),
        )
        .min(1)
        .max(30),
    })
    .strict(),
  partners: z
    .object({
      ...contentFields,
      website: safeUrl,
      relationship: z
        .enum(["ecosystem", "pending", "partner"])
        .default("pending"),
    })
    .strict(),
  courses: z
    .object({
      id: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9-]+$/),
      title: contentFields.title,
      description: contentFields.description,
      department: z.enum(["langues", "management", "informatique", "finance"]),
      topics: strings,
      level: z.string().max(100).default("Tous niveaux"),
      duration: z.string().max(100).default("Durée adaptée au programme"),
      format: z.string().max(80).default("Présentiel"),
      image: z
        .enum(["langues", "management", "informatique", "finance"])
        .default("informatique"),
      tag: z.string().max(80).default(""),
      phase: z.string().max(100).default(""),
      featured: z.boolean().default(false),
      published: z.boolean().default(false),
    })
    .strict(),
};
export const personSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[+\d\s().-]+$/),
    courseId: z.string().max(80).default(""),
    schedule: z
      .enum(["matin", "soir", "week-end", "flexible"])
      .default("flexible"),
    message: z.string().max(2000).default(""),
    status: z.enum(["new", "contacted", "confirmed", "closed"]).default("new"),
    username: z
      .string()
      .trim()
      .max(50)
      .regex(/^[a-zA-Z0-9_.-]*$/)
      .default(""),
    password: password.optional().or(z.literal("")),
    profile: z
      .enum(["apprenant", "professionnel", "entreprise"])
      .default("apprenant"),
    kind: z.enum(["contact", "enterprise"]).optional(),
  })
  .strict();
