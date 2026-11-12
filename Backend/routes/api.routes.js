import { Router } from "express";
import rateLimit from "express-rate-limit";
import { centre, departments } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";
import { createCoursesController } from "../controllers/courses.controller.js";
import { createRequestController } from "../controllers/requests.controller.js";
import {
  getPublicPortal,
  getStaticPortal,
} from "../services/platform.service.js";
import { submitAssessment } from "../controllers/assessment.controller.js";
import { SiteVisit } from "../models/system.models.js";
import { today } from "../services/dates.js";

export function createApiRouter(dependencies) {
  const router = Router();
  const courses = createCoursesController(dependencies);
  const createRequest = createRequestController(dependencies);
  const requestLimit = rateLimit({
    windowMs: 3_600_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Trop de demandes. Veuillez réessayer plus tard ou appeler le centre.",
    },
  });
  router.get("/health", (_req, res) =>
    res.set("Cache-Control", "no-store").json({
      status: "ok",
      registrationsAvailable: dependencies.isDatabaseReady(),
    }),
  );
  router.get("/centre", (_req, res) => res.json({ centre, departments }));
  router.get("/content", (_req, res) => res.json(siteContent));
  router.get("/pages", async (_req, res, next) => {
    try {
      res.json(
        dependencies.isDatabaseReady()
          ? await getPublicPortal()
          : getStaticPortal(),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get("/courses", courses.list);
  router.get("/courses/:id", courses.detail);
  router.post("/requests", requestLimit, createRequest);
  // Fréquentation : une vue par page affichée, une visite par session de
  // navigateur. Aucune adresse IP ni cookie n’est conservé.
  router.post(
    "/visits",
    rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }),
    async (req, res) => {
      const path = typeof req.body?.path === "string" ? req.body.path : "";
      if (!dependencies.isDatabaseReady() || !/^\/[\w\-/.]{0,119}$/.test(path) || path.startsWith("/admin"))
        return res.status(204).end();
      const day = today();
      try {
        await SiteVisit.updateOne(
          { _id: `${day}|${path}` },
          {
            $setOnInsert: { day, path },
            $inc: { views: 1, sessions: req.body.newSession === true ? 1 : 0 },
          },
          { upsert: true },
        );
      } catch {}
      res.status(204).end();
    },
  );
  router.post("/assessments/:id/attempts", requestLimit, submitAssessment);
  router.use("/admin", (_req, _res, next) => next("router"));
  router.use((_req, res) =>
    res.status(404).json({ error: "Route introuvable." }),
  );
  return router;
}
