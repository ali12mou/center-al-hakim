import mongoose from "mongoose";
import { AdminSession, AdminUser } from "../models/platform.models.js";
import { ApiLog } from "../models/system.models.js";
import { hashToken } from "../services/password.service.js";
import {
  SESSION_IDLE,
  safeEqual,
  clientIp,
} from "../services/security.service.js";
import { can, isSuperAdmin } from "../config/permissions.js";

const FORBIDDEN =
  "Votre compte n’a pas l’autorisation d’effectuer cette action. Demandez-la à l’administrateur général.";
// `section` peut dépendre de la requête (ex. enseignant ou employé).
export const permit = (section, action = "view") =>
  function checkPermission(req, res, next) {
    const target = typeof section === "function" ? section(req) : section;
    if (!target || !can(req.admin, target, action))
      return res.status(403).json({ error: FORBIDDEN, forbidden: true });
    next();
  };
export function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.admin))
    return res.status(403).json({
      error: "Section réservée à l’administrateur général.",
      forbidden: true,
    });
  next();
}

// Chaque appel à l’API d’administration est journalisé (méthode, route,
// statut, durée, compte, adresse IP) pour l’écran Sécurité. Les lectures
// très fréquentes et sans intérêt (badges, état de session) sont ignorées.
const QUIET = ["/auth/status", "/badges"];
export function logApiCalls(req, res, next) {
  const started = Date.now();
  res.on("finish", () => {
    if (req.method === "GET" && QUIET.includes(req.path)) return;
    if (req.method === "OPTIONS" || mongoose.connection.readyState !== 1) return;
    ApiLog.create({
      userId: req.admin?._id,
      username: req.admin?.username || "",
      method: req.method,
      path: req.path.slice(0, 200),
      status: res.statusCode,
      ms: Date.now() - started,
      ip: clientIp(req),
    }).catch(() => {});
  });
  next();
}

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
// Avec un mot de passe temporaire, seules ces routes restent ouvertes.
const PASSWORD_CHANGE_ROUTES = ["/auth/password", "/auth/logout"];

export function readSessionCookie(req) {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("ah_admin="));
  try {
    return entry ? decodeURIComponent(entry.slice("ah_admin=".length)) : "";
  } catch {
    return "";
  }
}

// Session valide, ou null si elle est absente, expirée ou inactive depuis trop longtemps.
export async function findActiveSession(req) {
  const token = readSessionCookie(req);
  if (!token) return null;
  const session = await AdminSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const lastSeen = session.lastSeenAt || session.createdAt;
  if (Date.now() - lastSeen.getTime() > SESSION_IDLE) {
    await AdminSession.deleteOne({ _id: session._id });
    return null;
  }
  // Une écriture par minute au plus suffit pour mesurer l’inactivité.
  if (Date.now() - lastSeen.getTime() > 60_000) {
    session.lastSeenAt = new Date();
    await session.save();
  }
  return session;
}

export async function requireAdmin(req, res, next) {
  try {
    if (!readSessionCookie(req))
      return res
        .status(401)
        .json({ error: "Connectez-vous à l’administration." });
    const session = await findActiveSession(req);
    if (!session)
      return res.status(401).json({
        error: "Votre session a expiré. Reconnectez-vous.",
        sessionExpired: true,
      });
    const user = await AdminUser.findById(session.userId);
    if (!user || !["admin", "staff"].includes(user.role))
      return res.status(403).json({ error: "Accès administrateur requis." });
    // Compte désactivé par l’administrateur général : la session tombe aussitôt.
    if (user.active === false) {
      await AdminSession.deleteMany({ userId: user._id });
      return res.status(401).json({
        error: "Ce compte a été désactivé. Contactez l’administrateur général.",
        sessionExpired: true,
      });
    }
    if (
      !SAFE_METHODS.includes(req.method) &&
      !safeEqual(req.get("X-CSRF-Token"), session.csrfToken)
    )
      return res.status(403).json({
        error: "La vérification de sécurité a échoué. Rechargez la page.",
      });
    if (user.mustChangePassword && !PASSWORD_CHANGE_ROUTES.includes(req.path))
      return res.status(403).json({
        error: "Choisissez un nouveau mot de passe pour continuer.",
        passwordChangeRequired: true,
      });
    req.admin = user;
    req.adminSession = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function localSetupAllowed(req) {
  const ip = req.socket.remoteAddress;
  const origin = req.get("Origin");
  const allowed = (
    process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173"
  )
    .split(",")
    .map((value) => value.trim());
  const sameOrigin =
    !origin ||
    allowed.includes(origin) ||
    origin === `http://${req.get("host")}`;
  return (
    process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) &&
    sameOrigin
  );
}
