import { randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  MarketingAgent,
  MarketingSession,
  MarketingProspect,
} from "../models/marketing.models.js";
import { Course } from "../models/index.js";
import { hashPassword, verifyPassword, hashToken } from "../services/password.service.js";
import {
  safeEqual,
  clientIp,
  clientAgent,
  loginLockedUntil,
  registerLoginFailure,
  clearLoginFailures,
} from "../services/security.service.js";
import { passwordProblem } from "../validators/password-policy.js";
import { httpError, sendError, parseBody, validId } from "../services/crud.js";
import {
  prospectSchema,
  statusSchema,
  prospectLabels,
  agentActor,
  createProspect,
  updateProspect,
  changeStatus,
  listProspects,
  prospectStats,
  prospectHistory,
  publicProspect,
  logActivity,
} from "../services/marketing.service.js";

// Portail des agents marketing (/marketings) : chaque agent ne voit et ne
// modifie que les prospects qu’il a collectés. Le cookie « ah_marketing »
// n’est envoyé qu’aux adresses /api/marketing : il n’ouvre jamais l’administration.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const SESSION_IDLE = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 5;
const COOKIE = "ah_marketing";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api/marketing",
};
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const PASSWORD_ROUTES = ["/auth/password", "/auth/logout"];
const throttleName = (email) => `marketing:${email}`;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  password: z.string().min(1).max(128),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});
const publicAgent = (agent) => ({
  id: agent._id,
  reference: agent.reference,
  name: agent.name,
  email: agent.email,
  phone: agent.phone,
  mustChangePassword: Boolean(agent.mustChangePassword),
});

let dummyHash;
const timingHash = () => (dummyHash ||= hashPassword(randomBytes(16).toString("hex")));

function readCookie(req) {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${COOKIE}=`));
  try {
    return entry ? decodeURIComponent(entry.slice(COOKIE.length + 1)) : "";
  } catch {
    return "";
  }
}
async function findSession(req) {
  const token = readCookie(req);
  if (!token) return null;
  const session = await MarketingSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const lastSeen = session.lastSeenAt || session.createdAt;
  if (Date.now() - lastSeen.getTime() > SESSION_IDLE) {
    await MarketingSession.deleteOne({ _id: session._id });
    return null;
  }
  if (Date.now() - lastSeen.getTime() > 5 * 60_000) {
    session.lastSeenAt = new Date();
    await session.save();
  }
  return session;
}
async function startSession(agent, req, res) {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  await MarketingSession.create({
    agentId: agent._id,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE),
    lastSeenAt: new Date(),
    ip: clientIp(req),
    userAgent: clientAgent(req),
  });
  const stale = await MarketingSession.find({ agentId: agent._id })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS)
    .select("_id")
    .lean();
  if (stale.length)
    await MarketingSession.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE });
  return { user: publicAgent(agent), csrfToken };
}
async function requireAgent(req, res, next) {
  try {
    const session = await findSession(req);
    if (!session)
      return res.status(401).json({ error: "Connectez-vous à votre espace marketing.", sessionExpired: true });
    const agent = await MarketingAgent.findById(session.agentId);
    if (!agent || agent.active === false) {
      await MarketingSession.deleteMany({ agentId: session.agentId });
      return res.status(401).json({
        error: "Votre compte est désactivé. Contactez l’administration du centre.",
        sessionExpired: true,
      });
    }
    if (!SAFE_METHODS.includes(req.method) && !safeEqual(req.get("X-CSRF-Token"), session.csrfToken))
      return res.status(403).json({ error: "La vérification de sécurité a échoué. Rechargez la page." });
    if (agent.mustChangePassword && !PASSWORD_ROUTES.includes(req.path))
      return res.status(403).json({
        error: "Choisissez votre mot de passe personnel pour continuer.",
        passwordChangeRequired: true,
      });
    req.agent = agent;
    req.agentSession = session;
    next();
  } catch (error) {
    next(error);
  }
}
const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
// Un agent n’accède qu’à ses propres prospects.
async function ownProspect(req) {
  if (!validId(req.params.id)) throw httpError(404, "Prospect introuvable.");
  const prospect = await MarketingProspect.findOne({ _id: req.params.id, agentId: req.agent._id });
  if (!prospect) throw httpError(404, "Prospect introuvable.");
  return prospect;
}

export function createMarketingRouter(isDatabaseReady) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!isDatabaseReady())
      return res.status(503).json({ error: "Le service est momentanément indisponible. Réessayez dans un instant." });
    next();
  });
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
  });

  router.get(
    "/auth/status",
    wrap(async (req, res) => {
      const session = await findSession(req);
      const agent = session && (await MarketingAgent.findById(session.agentId));
      const valid = agent && agent.active !== false;
      res.json({ user: valid ? publicAgent(agent) : null, csrfToken: valid ? session.csrfToken : null });
    }),
  );
  router.post(
    "/auth/login",
    loginLimit,
    wrap(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw httpError(400, "Renseignez votre adresse e-mail et votre mot de passe.");
      const { email, password } = parsed.data;
      const lockedUntil = await loginLockedUntil(throttleName(email));
      if (lockedUntil) {
        const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
        throw httpError(429, `Trop de tentatives. Réessayez dans ${minutes} min.`);
      }
      const agent = await MarketingAgent.findOne({ email }).select("+passwordHash");
      const valid = await verifyPassword(password, agent?.passwordHash || (await timingHash()));
      if (!agent || !valid) {
        const locked = await registerLoginFailure(throttleName(email));
        throw httpError(
          locked ? 429 : 401,
          locked
            ? "Trop de tentatives. Pour votre sécurité, la connexion est bloquée 15 minutes."
            : "Adresse e-mail ou mot de passe incorrect.",
        );
      }
      await clearLoginFailures(throttleName(email));
      if (agent.active === false)
        throw httpError(403, "Votre compte est désactivé. Contactez l’administration du centre.");
      agent.lastLoginAt = new Date();
      await agent.save();
      await logActivity(agent._id, "login", req);
      res.json(await startSession(agent, req, res));
    }),
  );

  // Liste des formations (publique, pour la page d’accueil et le formulaire).
  router.get(
    "/courses",
    wrap(async (_req, res) => {
      const items = await Course.find({ published: { $ne: false } })
        .select("id title department")
        .sort({ title: 1 })
        .lean();
      res.json({ items: items.map(({ id, title, department }) => ({ id, title, department })) });
    }),
  );

  router.use(requireAgent);

  router.post(
    "/auth/logout",
    wrap(async (req, res) => {
      await MarketingSession.deleteOne({ _id: req.agentSession._id });
      await logActivity(req.agent._id, "logout", req);
      res.clearCookie(COOKIE, cookieOptions);
      res.json({ message: "Vous êtes déconnecté." });
    }),
  );
  router.post(
    "/auth/password",
    loginLimit,
    wrap(async (req, res) => {
      const parsed = passwordSchema.safeParse(req.body);
      if (!parsed.success) throw httpError(400, "Renseignez votre mot de passe actuel et le nouveau.");
      const { currentPassword, newPassword } = parsed.data;
      const agent = await MarketingAgent.findById(req.agent._id).select("+passwordHash");
      if (!(await verifyPassword(currentPassword, agent.passwordHash)))
        throw httpError(400, "Le mot de passe actuel est incorrect.");
      const problem = passwordProblem(newPassword, { username: agent.email.split("@")[0] });
      if (problem) throw httpError(400, problem);
      if (await verifyPassword(newPassword, agent.passwordHash))
        throw httpError(400, "Choisissez un mot de passe différent de l’actuel.");
      agent.passwordHash = await hashPassword(newPassword);
      agent.mustChangePassword = false;
      agent.passwordChangedAt = new Date();
      await agent.save();
      await MarketingSession.deleteMany({ agentId: agent._id });
      await logActivity(agent._id, "password_changed", req);
      res.json(await startSession(agent, req, res));
    }),
  );

  const mine = (req) => ({ agentId: req.agent._id });
  router.get("/stats", wrap(async (req, res) => res.json(await prospectStats(req.query, mine(req)))));
  router.get("/prospects", wrap(async (req, res) => res.json(await listProspects(req.query, mine(req)))));
  router.post(
    "/prospects",
    wrap(async (req, res) => {
      const data = parseBody(prospectSchema, req.body, prospectLabels);
      const prospect = await createProspect(data, { by: agentActor(req.agent), agent: req.agent, reveal: false });
      await logActivity(req.agent._id, "prospect_created", req, {
        prospectId: prospect._id,
        details: `${prospect.reference} · ${prospect.name}`,
      });
      res.status(201).json({ item: publicProspect(prospect) });
    }),
  );
  router.patch(
    "/prospects/:id",
    wrap(async (req, res) => {
      const prospect = await ownProspect(req);
      const data = parseBody(prospectSchema.omit({ status: true }).partial(), req.body, prospectLabels);
      await updateProspect(prospect, data, false);
      await logActivity(req.agent._id, "prospect_updated", req, {
        prospectId: prospect._id,
        details: `${prospect.reference} · ${prospect.name}`,
      });
      res.json({ item: publicProspect(prospect) });
    }),
  );
  router.post(
    "/prospects/:id/status",
    wrap(async (req, res) => {
      const prospect = await ownProspect(req);
      const from = prospect.status;
      const data = parseBody(statusSchema, req.body, prospectLabels);
      await changeStatus(prospect, data, agentActor(req.agent));
      await logActivity(req.agent._id, "status_changed", req, {
        prospectId: prospect._id,
        details: `${prospect.reference} : ${from} → ${prospect.status}`,
      });
      res.json({ item: publicProspect(prospect) });
    }),
  );
  router.get(
    "/prospects/:id/history",
    wrap(async (req, res) => {
      const prospect = await ownProspect(req);
      res.json({ item: publicProspect(prospect), items: await prospectHistory(prospect._id) });
    }),
  );
  return router;
}
