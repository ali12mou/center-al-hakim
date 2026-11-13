import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  requireAdmin,
  permit,
  logApiCalls,
} from "../middleware/admin.middleware.js";
import {
  authStatus,
  verifyOtp,
  resendOtp,
  forgotPassword,
  verifyResetCode,
  resetPassword,
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
  uploadPrivateFile,
  sendPrivateFile,
  UPLOAD_TYPES,
  FILE_TYPES,
  MAX_UPLOAD,
  MAX_VIDEO_UPLOAD,
} from "../controllers/upload.controller.js";
import { createHrRouter } from "./hr.routes.js";
import { createFinanceRouter } from "./finance.routes.js";
import { createSystemRouter, createLookupRouter } from "./system.routes.js";
import { createStudentsAdminRouter } from "./students-admin.routes.js";
import { createMarketingAdminRouter } from "./marketing-admin.routes.js";
import { canModule, isSuperAdmin } from "../config/permissions.js";

const limiter = (windowMinutes, limit, error) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(error ? { message: { error } } : {}),
  });
// Les résultats des tests relèvent de la section « Skill Assessment ».
const resourceSection = (req) =>
  req.params.resource === "attempts"
    ? "centre.assessments"
    : `centre.${req.params.resource}`;
// Importer suppose de pouvoir ajouter ou modifier dans le module concerné.
const canWrite = (modules) => (req, res, next) =>
  isSuperAdmin(req.admin) ||
  (req.admin.permissions || []).some(
    (value) =>
      modules.some((module) => value.startsWith(`${module}.`)) &&
      /:(create|update)$/.test(value),
  )
    ? next()
    : res.status(403).json({
        error: "Votre compte n’a pas l’autorisation d’importer des fichiers.",
        forbidden: true,
      });
const canReadDocuments = (req, res, next) =>
  canModule(req.admin, "rh") || canModule(req.admin, "finance") || canModule(req.admin, "eleves")
    ? next()
    : res.status(403).json({ error: "Accès non autorisé.", forbidden: true });

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
  router.use(logApiCalls);
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
  router.post("/auth/otp", loginLimit, verifyOtp);
  router.post("/auth/otp/resend", loginLimit, resendOtp);
  router.post("/auth/login", loginLimit, loginAdmin);
  // Mot de passe oublié : limité plus strictement (envoi d’e-mails).
  const forgotLimit = limiter(
    15,
    5,
    "Trop de demandes de réinitialisation. Réessayez dans 15 minutes.",
  );
  router.post("/auth/forgot", forgotLimit, forgotPassword);
  router.post("/auth/forgot/verify", loginLimit, verifyResetCode);
  router.post("/auth/forgot/reset", passwordLimit, resetPassword);
  router.use(requireAdmin);
  router.post("/auth/logout", logoutAdmin);
  router.post("/auth/password", passwordLimit, changePassword);
  router.get("/auth/sessions", listSessions);
  router.delete("/auth/sessions", revokeOtherSessions);
  router.get("/security", securityOverview);
  router.get("/dashboard", permit("centre.dashboard"), dashboard);
  router.get("/badges", badges);
  router.get("/resources/:resource", permit(resourceSection, "view"), listResource);
  router.post("/resources/:resource", permit(resourceSection, "create"), saveResource);
  router.patch("/resources/:resource/:id", permit(resourceSection, "update"), saveResource);
  router.delete("/resources/:resource/:id", permit(resourceSection, "delete"), deleteResource);
  router.post(
    "/emails",
    limiter(60, 30),
    permit((req) => `centre.${req.body?.resource}`, "update"),
    sendAdminEmail,
  );
  router.post(
    "/uploads",
    limiter(60, 60, "Trop d’images importées. Réessayez dans une heure."),
    canWrite(["centre"]),
    express.raw({ type: UPLOAD_TYPES, limit: MAX_VIDEO_UPLOAD }),
    uploadImage,
  );
  router.post(
    "/files",
    limiter(60, 120, "Trop de documents importés. Réessayez dans une heure."),
    canWrite(["rh", "finance", "eleves"]),
    express.raw({ type: FILE_TYPES, limit: MAX_UPLOAD }),
    uploadPrivateFile,
  );
  router.get("/files/:name", canReadDocuments, sendPrivateFile);
  router.use("/lookups", createLookupRouter());
  router.use("/rh", createHrRouter());
  router.use("/finance", createFinanceRouter());
  router.use("/system", createSystemRouter());
  router.use("/eleves", createStudentsAdminRouter());
  router.use("/marketing", createMarketingAdminRouter());
  return router;
}
