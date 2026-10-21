import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  authStatus,
  setupAdmin,
  loginAdmin,
  logoutAdmin,
  changePassword,
  listSessions,
  revokeOtherSessions,
  securityOverview,
} from "../controllers/auth.controller.js";
import {
  dashboard,
  badges,
  listResource,
  saveResource,
  deleteResource,
} from "../controllers/admin.controller.js";
import { sendAdminEmail } from "../controllers/email.controller.js";
import {
  uploadImage,
  UPLOAD_TYPES,
  MAX_VIDEO_UPLOAD,
} from "../controllers/upload.controller.js";

const limiter = (windowMinutes, limit, error) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(error ? { message: { error } } : {}),
  });

export function createAdminRouter(isDatabaseReady) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!isDatabaseReady())
      return res.status(503).json({
        error:
          "La base MongoDB est indisponible. Vérifiez la connexion du backend.",
      });
    next();
  });
  // Par adresse IP ; le verrouillage par identifiant s’ajoute dans le contrôleur.
  const loginLimit = limiter(
    15,
    20,
    "Trop de tentatives. Réessayez dans 15 minutes.",
  );
  const passwordLimit = limiter(
    15,
    10,
    "Trop de tentatives de changement. Réessayez dans 15 minutes.",
  );
  router.get("/auth/status", authStatus);
  router.post("/auth/setup", loginLimit, setupAdmin);
  router.post("/auth/login", loginLimit, loginAdmin);
  router.use(requireAdmin);
  router.post("/auth/logout", logoutAdmin);
  router.post("/auth/password", passwordLimit, changePassword);
  router.get("/auth/sessions", listSessions);
  router.delete("/auth/sessions", revokeOtherSessions);
  router.get("/security", securityOverview);
  router.get("/dashboard", dashboard);
  router.get("/badges", badges);
  router.get("/resources/:resource", listResource);
  router.post("/resources/:resource", saveResource);
  router.patch("/resources/:resource/:id", saveResource);
  router.delete("/resources/:resource/:id", deleteResource);
  router.post("/emails", limiter(60, 30), sendAdminEmail);
  router.post(
    "/uploads",
    limiter(60, 60, "Trop d’images importées. Réessayez dans une heure."),
    express.raw({ type: UPLOAD_TYPES, limit: MAX_VIDEO_UPLOAD }),
    uploadImage,
  );
  return router;
}
