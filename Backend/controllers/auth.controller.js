import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import {
  AdminUser,
  AdminSession,
  AdminAudit,
  AdminOtp,
} from "../models/platform.models.js";
import { mailConfigured, sendMail, otpEmail } from "../services/mail.service.js";
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
import { findActiveSession } from "../middleware/admin.middleware.js";
import {
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
export const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
  jobTitle: user.jobTitle || "",
  permissions: user.role === "admin" ? [] : user.permissions || [],
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
    const session = await findActiveSession(req);
    const found = session && (await AdminUser.findById(session.userId));
    const user = found?.active === false ? null : found;
    res.json({
      user: user ? publicUser(user) : null,
      csrfToken: user ? session.csrfToken : null,
      idleMinutes: SESSION_IDLE / 60_000,
    });
  } catch (error) {
    next(error);
  }
}

// Vérification en deux étapes : mot de passe, puis code à 6 chiffres envoyé
// par e-mail à chaque connexion.
const OTP_TTL = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_DELAY = 60_000;
const OTP_MAX_RESENDS = 3;
// Uniquement pour les tests automatisés, jamais en production.
const otpDisabled = () =>
  process.env.ADMIN_OTP === "off" && process.env.NODE_ENV !== "production";
const challengeField = z.string().regex(/^[a-f0-9]{64}$/);
const otpSchema = z
  .object({ challenge: challengeField, code: z.string().regex(/^\d{6}$/) })
  .strict();
const resendSchema = z.object({ challenge: challengeField }).strict();
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const otpHash = (challenge, code) =>
  createHmac("sha256", challenge).update(code).digest("hex");
const sameHash = (a, b) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function maskEmail(email = "") {
  const [local, domain] = email.split("@");
  if (!domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
const findOtp = (challenge) =>
  AdminOtp.findOne({
    challengeHash: hashToken(challenge),
    expiresAt: { $gt: new Date() },
  });
const expiredOtp = (res) =>
  res.status(400).json({
    error: "Ce code a expiré ou n’est plus valable. Reconnectez-vous.",
    otpExpired: true,
  });

class MailError extends Error {}
async function deliverOtp(user, code, req) {
  const message = otpEmail({
    name: user.name,
    code,
    minutes: OTP_TTL / 60_000,
    ip: clientIp(req),
    device: describeAgent(clientAgent(req)),
  });
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production")
      throw new MailError(
        "L’envoi du code par e-mail n’est pas configuré sur le serveur (SMTP).",
      );
    // Développement local sans SMTP : le code s’affiche dans le terminal du serveur.
    console.warn(
      `\n[OTP] SMTP non configuré — code pour ${user.username} (${user.email}) : ${code}\n`,
    );
    return "console";
  }
  try {
    await sendMail({ to: user.email, ...message });
  } catch (error) {
    console.error("[OTP] Envoi de l’e-mail impossible :", error.message);
    throw new MailError(
      "Le code de vérification n’a pas pu être envoyé par e-mail. Réessayez dans un instant.",
    );
  }
}
async function issueOtp(user, req) {
  const challenge = randomBytes(32).toString("hex");
  const code = newCode();
  // Un seul code actif par compte : une nouvelle connexion annule l’ancien.
  await AdminOtp.deleteMany({ userId: user._id });
  let delivery;
  const otp = await AdminOtp.create({
    challengeHash: hashToken(challenge),
    userId: user._id,
    codeHash: otpHash(challenge, code),
    expiresAt: new Date(Date.now() + OTP_TTL),
  });
  try {
    delivery = await deliverOtp(user, code, req);
  } catch (error) {
    await AdminOtp.deleteOne({ _id: otp._id });
    throw error;
  }
  await audit("otp_sent", req, { user });
  return {
    otpRequired: true,
    challenge,
    email: maskEmail(user.email),
    expiresIn: OTP_TTL / 1000,
    resendIn: OTP_RESEND_DELAY / 1000,
    // Développement sans SMTP : l’écran indique où lire le code.
    ...(delivery === "console" ? { delivery } : {}),
  };
}
async function completeLogin(user, req, res) {
  user.lastLoginAt = new Date();
  await user.save();
  await audit("login_success", req, { user });
  return startSession(user, req, res);
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
    // Le mot de passe est juste : on peut dire que le compte est désactivé.
    if (user.active === false) {
      await audit("login_disabled", req, { user });
      return res.status(403).json({
        error: "Ce compte est désactivé. Contactez l’administrateur général.",
      });
    }
    if (otpDisabled()) return res.json(await completeLogin(user, req, res));
    try {
      res.json(await issueOtp(user, req));
    } catch (error) {
      if (error instanceof MailError)
        return res.status(502).json({ error: error.message });
      throw error;
    }
  } catch (error) {
    next(error);
  }
}
export async function verifyOtp(req, res, next) {
  try {
    const parsed = otpSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Saisissez le code à 6 chiffres reçu par e-mail." });
    const { challenge, code } = parsed.data;
    const otp = await findOtp(challenge);
    if (!otp) return expiredOtp(res);
    const user = await AdminUser.findById(otp.userId);
    if (!user || user.active === false) {
      await AdminOtp.deleteOne({ _id: otp._id });
      return expiredOtp(res);
    }
    if (!sameHash(otp.codeHash, otpHash(challenge, code))) {
      otp.attempts += 1;
      await audit("otp_failure", req, { user });
      // Les mauvais codes comptent aussi dans le verrouillage du compte.
      const locked = await registerLoginFailure(user.username);
      if (locked || otp.attempts >= OTP_MAX_ATTEMPTS) {
        await AdminOtp.deleteOne({ _id: otp._id });
        if (locked) return lockedResponse(res, locked);
        return res.status(400).json({
          error:
            "Trop de codes incorrects. Reconnectez-vous pour recevoir un nouveau code.",
          otpExpired: true,
        });
      }
      await otp.save();
      const left = OTP_MAX_ATTEMPTS - otp.attempts;
      return res.status(400).json({
        error: `Code incorrect. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`,
      });
    }
    await AdminOtp.deleteOne({ _id: otp._id });
    await clearLoginFailures(user.username);
    res.json(await completeLogin(user, req, res));
  } catch (error) {
    next(error);
  }
}
export async function resendOtp(req, res, next) {
  try {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) return expiredOtp(res);
    const { challenge } = parsed.data;
    const otp = await findOtp(challenge);
    if (!otp) return expiredOtp(res);
    const wait = otp.sentAt.getTime() + OTP_RESEND_DELAY - Date.now();
    if (wait > 0)
      return res.status(429).json({
        error: `Patientez ${Math.ceil(wait / 1000)} s avant de demander un nouveau code.`,
        resendIn: Math.ceil(wait / 1000),
      });
    if (otp.resends >= OTP_MAX_RESENDS)
      return res.status(429).json({
        error: "Nombre maximal d’envois atteint. Reconnectez-vous.",
        otpExpired: true,
      });
    const user = await AdminUser.findById(otp.userId);
    if (!user || user.active === false) return expiredOtp(res);
    const code = newCode();
    try {
      await deliverOtp(user, code, req);
    } catch (error) {
      if (error instanceof MailError)
        return res.status(502).json({ error: error.message });
      throw error;
    }
    otp.codeHash = otpHash(challenge, code);
    otp.attempts = 0;
    otp.resends += 1;
    otp.sentAt = new Date();
    otp.expiresAt = new Date(Date.now() + OTP_TTL);
    await otp.save();
    await audit("otp_sent", req, { user });
    res.json({
      message: "Un nouveau code vient de vous être envoyé.",
      expiresIn: OTP_TTL / 1000,
      resendIn: OTP_RESEND_DELAY / 1000,
    });
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
