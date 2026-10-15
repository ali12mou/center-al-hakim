import { randomBytes } from "node:crypto";
import {
  AdminUser,
  AdminSession,
  AdminAudit,
} from "../models/platform.models.js";
import {
  hashPassword,
  verifyPassword,
  hashToken,
} from "../services/password.service.js";
import {
  SESSION_MAX_AGE,
  SESSION_IDLE,
  MAX_SESSIONS,
  audit,
  clientIp,
  clientAgent,
  describeAgent,
  loginLockedUntil,
  registerLoginFailure,
  clearLoginFailures,
} from "../services/security.service.js";
import {
  localSetupAllowed,
  findActiveSession,
} from "../middleware/admin.middleware.js";
import {
  setupSchema,
  loginSchema,
  passwordChangeSchema,
} from "../validators/admin.validator.js";
import { passwordProblem } from "../validators/password-policy.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api",
};
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
  mustChangePassword: Boolean(user.mustChangePassword),
});
// Un identifiant inconnu coûte le même calcul scrypt qu’un identifiant valide.
let dummyHash;
const timingHash = () => (dummyHash ||= hashPassword(randomBytes(16).toString("hex")));

async function startSession(user, req, res) {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const now = Date.now();
  await AdminSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(now + SESSION_MAX_AGE),
    lastSeenAt: new Date(now),
    ip: clientIp(req),
    userAgent: clientAgent(req),
  });
  // Au-delà de MAX_SESSIONS appareils, les sessions les plus anciennes sont fermées.
  const stale = await AdminSession.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS)
    .select("_id")
    .lean();
  if (stale.length)
    await AdminSession.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  res.cookie("ah_admin", token, { ...cookieOptions, maxAge: SESSION_MAX_AGE });
  return { user: publicUser(user), csrfToken };
}
function lockedResponse(res, lockedUntil) {
  const seconds = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
  res.set("Retry-After", String(seconds));
  return res.status(429).json({
    error: `Trop de tentatives. Pour votre sécurité, la connexion est bloquée pendant ${Math.ceil(seconds / 60)} min.`,
    lockedUntil,
  });
}

export async function authStatus(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    const setupRequired = (await AdminUser.countDocuments()) === 0;
    const session = await findActiveSession(req);
    const user = session && (await AdminUser.findById(session.userId));
    res.json({
      setupRequired,
      setupAllowed: setupRequired && localSetupAllowed(req),
      user: user ? publicUser(user) : null,
      csrfToken: user ? session.csrfToken : null,
      idleMinutes: SESSION_IDLE / 60_000,
    });
  } catch (error) {
    next(error);
  }
}
export async function setupAdmin(req, res, next) {
  try {
    if (!localSetupAllowed(req))
      return res.status(403).json({
        error:
          "La création initiale se fait uniquement depuis le serveur local. Utilisez le script de création pour la production.",
      });
    if (await AdminUser.exists({ role: "admin" }))
      return res
        .status(409)
        .json({ error: "L’administration est déjà configurée." });
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });
    const { password, ...data } = parsed.data;
    const problem = passwordProblem(password, data);
    if (problem) return res.status(400).json({ error: problem });
    const user = await AdminUser.create({
      ...data,
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      lastLoginAt: new Date(),
      bootstrap: true,
    });
    await audit("setup", req, { user });
    res.status(201).json(await startSession(user, req, res));
  } catch (error) {
    next(error);
  }
}
export async function loginAdmin(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Renseignez votre identifiant et votre mot de passe." });
    const username = parsed.data.username.toLowerCase();
    const lockedUntil = await loginLockedUntil(username);
    if (lockedUntil) return lockedResponse(res, lockedUntil);
    const user = await AdminUser.findOne({ username }).select("+passwordHash");
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash || (await timingHash()),
    );
    if (!user || !valid) {
      const locked = await registerLoginFailure(username);
      // Un identifiant inconnu n’est pas journalisé : ce peut être un mot de passe mal placé.
      await audit(locked ? "login_locked" : "login_failure", req, { user });
      if (locked) return lockedResponse(res, locked);
      return res
        .status(401)
        .json({ error: "Identifiant ou mot de passe incorrect." });
    }
    await clearLoginFailures(username);
    user.lastLoginAt = new Date();
    await user.save();
    await audit("login_success", req, { user });
    res.json(await startSession(user, req, res));
  } catch (error) {
    next(error);
  }
}
export async function logoutAdmin(req, res, next) {
  try {
    await AdminSession.deleteOne({ _id: req.adminSession._id });
    await audit("logout", req, { user: req.admin });
    res.clearCookie("ah_admin", cookieOptions);
    res.json({ message: "Vous êtes déconnecté." });
  } catch (error) {
    next(error);
  }
}
export async function changePassword(req, res, next) {
  try {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        error: "Renseignez votre mot de passe actuel et le nouveau.",
      });
    const { currentPassword, newPassword } = parsed.data;
    const user = await AdminUser.findById(req.admin._id).select("+passwordHash");
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await audit("password_change_failed", req, { user });
      return res
        .status(400)
        .json({ error: "Le mot de passe actuel est incorrect." });
    }
    const problem = passwordProblem(newPassword, user);
    if (problem) return res.status(400).json({ error: problem });
    if (await verifyPassword(newPassword, user.passwordHash))
      return res.status(400).json({
        error: "Choisissez un mot de passe différent de l’actuel.",
      });
    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();
    // Toutes les sessions existantes sont fermées ; celle-ci est renouvelée.
    await AdminSession.deleteMany({ userId: user._id });
    await audit("password_changed", req, { user });
    res.json(await startSession(user, req, res));
  } catch (error) {
    next(error);
  }
}

const activeSessionFilter = (userId) => ({
  userId,
  expiresAt: { $gt: new Date() },
  lastSeenAt: { $gt: new Date(Date.now() - SESSION_IDLE) },
});
export async function listSessions(req, res, next) {
  try {
    const sessions = await AdminSession.find(activeSessionFilter(req.admin._id))
      .sort({ lastSeenAt: -1 })
      .lean();
    res.json({
      sessions: sessions.map((session) => ({
        id: session._id,
        device: describeAgent(session.userAgent),
        ip: session.ip,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: session._id.equals(req.adminSession._id),
      })),
    });
  } catch (error) {
    next(error);
  }
}
export async function revokeOtherSessions(req, res, next) {
  try {
    const { deletedCount } = await AdminSession.deleteMany({
      userId: req.admin._id,
      _id: { $ne: req.adminSession._id },
    });
    await audit("sessions_revoked", req, { user: req.admin });
    res.json({ revoked: deletedCount });
  } catch (error) {
    next(error);
  }
}
export async function securityOverview(req, res, next) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [events, failures24h, activeSessions, logins] = await Promise.all([
      AdminAudit.find().sort({ createdAt: -1 }).limit(12).lean(),
      AdminAudit.countDocuments({
        event: { $in: ["login_failure", "login_locked"] },
        createdAt: { $gte: since },
      }),
      AdminSession.countDocuments(activeSessionFilter(req.admin._id)),
      AdminAudit.find({ userId: req.admin._id, event: "login_success" })
        .sort({ createdAt: -1 })
        .skip(1)
        .limit(1)
        .lean(),
    ]);
    const previous = logins[0];
    res.json({
      events: events.map((event) => ({
        id: event._id,
        event: event.event,
        username: event.username,
        ip: event.ip,
        device: describeAgent(event.userAgent),
        createdAt: event.createdAt,
      })),
      failures24h,
      activeSessions,
      previousLogin: previous
        ? {
            at: previous.createdAt,
            ip: previous.ip,
            device: describeAgent(previous.userAgent),
          }
        : null,
      passwordChangedAt: req.admin.passwordChangedAt || req.admin.createdAt,
      idleMinutes: SESSION_IDLE / 60_000,
      maxHours: SESSION_MAX_AGE / 3_600_000,
    });
  } catch (error) {
    next(error);
  }
}
