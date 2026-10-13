import { Router } from "express";
import rateLimit from "express-rate-limit";
import { centre, departments } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";
import { createCoursesController } from "../controllers/courses.controller.js";
import { createRequestController } from "../controllers/requests.controller.js";

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
    res
      .set("Cache-Control", "no-store")
      .json({
        status: "ok",
        registrationsAvailable: dependencies.isDatabaseReady(),
      }),
  );
  router.get("/centre", (_req, res) => res.json({ centre, departments }));
  router.get("/content", (_req, res) => res.json(siteContent));
  router.get("/courses", courses.list);
  router.get("/courses/:id", courses.detail);
  router.post("/requests", requestLimit, createRequest);
  router.use((_req, res) =>
    res.status(404).json({ error: "Route introuvable." }),
  );
  return router;
}
