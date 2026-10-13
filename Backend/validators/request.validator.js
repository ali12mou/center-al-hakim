import { z } from "zod";
import { courses } from "../data/catalogue.js";

export const requestSchema = z
  .object({
    name: z.string().trim().min(2, "Veuillez renseigner votre nom.").max(100),
    email: z.string().trim().email("Adresse e-mail invalide.").max(254),
    phone: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[+\d\s().-]+$/, "Numéro de téléphone invalide."),
    kind: z.enum(["registration", "enterprise", "contact"]),
    courseId: z.string().max(80).optional().default(""),
    schedule: z
      .enum(["matin", "soir", "week-end", "flexible"])
      .default("flexible"),
    message: z
      .string()
      .trim()
      .min(10, "Veuillez préciser votre demande.")
      .max(2000),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Votre consentement est nécessaire." }),
    }),
    website: z.string().max(0).optional().default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.kind === "registration" &&
      !courses.some((course) => course.id === value.courseId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["courseId"],
        message: "Choisissez une formation du catalogue.",
      });
    }
  });
