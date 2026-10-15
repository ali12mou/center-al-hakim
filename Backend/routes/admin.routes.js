import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  authStatus,
  setupAdmin,
  loginAdmin,
  logoutAdmin,
} from "../controllers/auth.controller.js";
import {
  dashboard,
  listResource,
  saveResource,
  deleteResource,
} from "../controllers/admin.controller.js";
import { sendAdminEmail } from "../controllers/email.controller.js";

export function createAdminRouter(isDatabaseReady) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!isDatabaseReady())
      return res
        .status(503)
        .json({
          error:
            "La base MongoDB est indisponible. Vérifiez la connexion du backend.",
        });
    next();
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
  });
  router.get("/auth/status", authStatus);
  router.post("/auth/setup", loginLimit, setupAdmin);
  router.post("/auth/login", loginLimit, loginAdmin);
  router.use(requireAdmin);
  router.post("/auth/logout", logoutAdmin);
  router.get("/dashboard", dashboard);
  router.get("/resources/:resource", listResource);
  router.post("/resources/:resource", saveResource);
  router.patch("/resources/:resource/:id", saveResource);
  router.delete("/resources/:resource/:id", deleteResource);
  router.post(
    "/emails",
    rateLimit({
      windowMs: 60 * 60_000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    sendAdminEmail,
  );
  return router;
}
