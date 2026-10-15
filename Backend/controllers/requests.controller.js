import { randomUUID } from "node:crypto";
import { Request } from "../models/index.js";
import mongoose from "mongoose";
import { Course } from "../models/index.js";
import { Registration, Contact } from "../models/platform.models.js";
import { courses } from "../data/catalogue.js";
import { requestSchema } from "../validators/request.validator.js";

export function createRequestController({ isDatabaseReady, saveRequest }) {
  return async function createRequest(req, res, next) {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: "Vérifiez les informations du formulaire.",
        fields: parsed.error.flatten().fieldErrors,
      });
    if (!isDatabaseReady())
      return res.status(503).json({
        error:
          "L’inscription en ligne est temporairement indisponible. Contactez le centre par téléphone ou WhatsApp.",
      });
    try {
      const { website, ...data } = parsed.data;
      if (data.kind === "registration") {
        const validCourse =
          mongoose.connection.readyState === 1
            ? await Course.exists({
                id: data.courseId,
                published: { $ne: false },
              })
            : courses.some((course) => course.id === data.courseId);
        if (!validCourse)
          return res
            .status(400)
            .json({
              error: "Choisissez une formation publiée dans le catalogue.",
            });
      }
      const reference = `AH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      // On confirme uniquement APRÈS un enregistrement réussi.
      if (saveRequest) await saveRequest({ ...data, reference });
      else
        await (data.kind === "registration" ? Registration : Contact).create({
          ...data,
          reference,
        });
      res.status(201).json({
        reference,
        message:
          "Votre demande a été enregistrée. Le centre vous contactera pour confirmer les modalités.",
      });
    } catch (error) {
      next(error);
    }
  };
}
