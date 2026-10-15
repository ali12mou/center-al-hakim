import mongoose from "mongoose";
import { z } from "zod";
import { Assessment, AssessmentAttempt } from "../models/platform.models.js";

const attemptSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().max(254),
    phone: z.string().max(30).default(""),
    answers: z.array(z.number().int().min(0).max(5)).min(1).max(30),
    consent: z.literal(true),
  })
  .strict();
export async function submitAssessment(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res
        .status(400)
        .json({ error: "Évaluation indisponible dans cet aperçu." });
    const parsed = attemptSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Vérifiez votre identité, vos réponses et le consentement.",
        });
    const assessment = await Assessment.findOne({
      _id: req.params.id,
      published: true,
    });
    if (!assessment)
      return res.status(404).json({ error: "Évaluation introuvable." });
    if (
      parsed.data.answers.length !== assessment.questions.length ||
      parsed.data.answers.some(
        (answer, index) => answer >= assessment.questions[index].choices.length,
      )
    )
      return res
        .status(400)
        .json({
          error: "Répondez à toutes les questions avec une option proposée.",
        });
    const score = parsed.data.answers.filter(
      (answer, index) => answer === assessment.questions[index].correctIndex,
    ).length;
    const total = assessment.questions.length;
    const percentage = Math.round((score / total) * 100);
    const recommendation =
      percentage < 50
        ? "Le programme Les essentiels de l’informatique peut vous aider à construire vos bases."
        : percentage < 85
          ? "Le parcours Word, Excel & PowerPoint peut vous aider à consolider vos acquis."
          : "Échangez avec le centre pour identifier un parcours de perfectionnement adapté.";
    await AssessmentAttempt.create({
      ...parsed.data,
      assessmentId: assessment._id,
      score,
      total,
      recommendation,
    });
    res
      .status(201)
      .json({
        score,
        total,
        percentage,
        recommendation,
        note: "Résultat indicatif : aucune certification n’est délivrée par ce test.",
      });
  } catch (error) {
    next(error);
  }
}
