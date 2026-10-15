import { AdminSession, AdminUser } from "../models/platform.models.js";
import { hashToken } from "../services/password.service.js";

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
export async function requireAdmin(req, res, next) {
  try {
    const token = readSessionCookie(req);
    if (!token)
      return res
        .status(401)
        .json({ error: "Connectez-vous à l’administration." });
    const session = await AdminSession.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session)
      return res
        .status(401)
        .json({ error: "Votre session a expiré. Reconnectez-vous." });
    const user = await AdminUser.findById(session.userId);
    if (!user || user.role !== "admin")
      return res.status(403).json({ error: "Accès administrateur requis." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("X-CSRF-Token") !== session.csrfToken
    )
      return res
        .status(403)
        .json({
          error: "La vérification de sécurité a échoué. Rechargez la page.",
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
