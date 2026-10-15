import { createHash, timingSafeEqual } from "node:crypto";
import {
  AdminAudit,
  LoginThrottle,
} from "../models/platform.models.js";

export const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
export const SESSION_IDLE = 30 * 60 * 1000;
export const MAX_SESSIONS = 5;
const MAX_FAILURES = 5;
const LOCK_DURATION = 15 * 60 * 1000;

export function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const throttleKey = (username) =>
  createHash("sha256").update(`login:${username.toLowerCase()}`).digest("hex");

export async function loginLockedUntil(username) {
  const entry = await LoginThrottle.findById(throttleKey(username)).lean();
  return entry?.lockedUntil > new Date() ? entry.lockedUntil : null;
}
// Renvoie la date de fin du verrouillage quand le seuil d’échecs est atteint.
export async function registerLoginFailure(username) {
  const now = Date.now();
  const entry = await LoginThrottle.findOneAndUpdate(
    { _id: throttleKey(username) },
    {
      $inc: { failures: 1 },
      $set: { expiresAt: new Date(now + 24 * 60 * 60 * 1000) },
    },
    { upsert: true, new: true },
  );
  if (entry.failures < MAX_FAILURES) return null;
  const lockedUntil = new Date(now + LOCK_DURATION);
  await LoginThrottle.updateOne(
    { _id: entry._id },
    { $set: { failures: 0, lockedUntil } },
  );
  return lockedUntil;
}
export const clearLoginFailures = (username) =>
  LoginThrottle.deleteOne({ _id: throttleKey(username) });

// « ::ffff:127.0.0.1 » est une adresse IPv4 vue par un serveur IPv6.
export const clientIp = (req) =>
  (req.ip || "").replace(/^::ffff:/, "").slice(0, 64);
export const clientAgent = (req) => (req.get("user-agent") || "").slice(0, 200);

// Le journal ne doit jamais bloquer une connexion : une erreur est seulement signalée.
export async function audit(event, req, { user, username = "" } = {}) {
  try {
    await AdminAudit.create({
      event,
      userId: user?._id,
      username: (user?.username || username).slice(0, 50),
      ip: req ? clientIp(req) : "",
      userAgent: req ? clientAgent(req) : "",
    });
  } catch (error) {
    console.error("Audit error:", error.name);
  }
}

export function describeAgent(agent = "") {
  const browser =
    [
      [/Edg\//, "Edge"],
      [/OPR\//, "Opera"],
      [/Firefox\//, "Firefox"],
      [/Chrome\//, "Chrome"],
      [/Safari\//, "Safari"],
    ].find(([pattern]) => pattern.test(agent))?.[1] || "Navigateur";
  const system =
    [
      [/Windows/, "Windows"],
      [/Android/, "Android"],
      [/iPhone|iPad/, "iOS"],
      [/Mac OS X/, "macOS"],
      [/Linux/, "Linux"],
    ].find(([pattern]) => pattern.test(agent))?.[1] || "";
  return system ? `${browser} · ${system}` : browser;
}
