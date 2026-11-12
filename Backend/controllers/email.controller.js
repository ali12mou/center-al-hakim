import mongoose from "mongoose";
import { z } from "zod";
import { Registration, Contact } from "../models/platform.models.js";
import { mailConfigured, sendMail } from "../services/mail.service.js";

const emailSchema = z
  .object({
    resource: z.enum(["registrations", "contacts"]),
    id: z.string(),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(10000),
  })
  .strict();
export async function sendAdminEmail(req, res, next) {
  try {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success || !mongoose.isValidObjectId(parsed.data?.id))
      return res
        .status(400)
        .json({ error: "Vérifiez le destinataire, l’objet et le message." });
    if (!mailConfigured())
      return res
        .status(409)
        .json({
          error:
            "L’envoi depuis le site nécessite une configuration SMTP. Vous pouvez ouvrir votre application e-mail.",
          smtpUnavailable: true,
        });
    const { resource, id, subject, message } = parsed.data;
    const record = await (
      resource === "registrations" ? Registration : Contact
    ).findById(id);
    if (!record)
      return res.status(404).json({ error: "Destinataire introuvable." });
    await sendMail({ to: record.email, subject, text: message });
    res.json({ message: "L’e-mail a été transmis au serveur de messagerie." });
  } catch (error) {
    next(error);
  }
}
