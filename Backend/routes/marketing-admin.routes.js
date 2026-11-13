import { Router } from "express";
import { z } from "zod";
import {
  MarketingAgent,
  MarketingSession,
  MarketingProspect,
  MarketingFollowup,
  MarketingActivity,
  AGENT_ACTIONS,
} from "../models/marketing.models.js";
import { nextNumber } from "../models/system.models.js";
import { can } from "../config/permissions.js";
import { hashPassword, temporaryPassword } from "../services/password.service.js";
import { passwordProblem } from "../validators/password-policy.js";
import { parseBody, sendError, httpError, escapeRegex, validId } from "../services/crud.js";
import {
  prospectSchema,
  statusSchema,
  prospectLabels,
  adminActor,
  createProspect,
  updateProspect,
  changeStatus,
  linkRegistration,
  listProspects,
  prospectStats,
  prospectHistory,
  publicProspect,
} from "../services/marketing.service.js";

// Administration du marketing : agents et prospects. Monté sous
// /api/admin/marketing (session administrateur).
const AGENTS = "centre.marketingAgents";
const PROSPECTS = "centre.prospects";
const FORBIDDEN = "Votre compte n’a pas l’autorisation d’effectuer cette action.";
const wrap = (section, action, handler) => async (req, res, next) => {
  try {
    if (!can(req.admin, section, action)) throw httpError(403, FORBIDDEN);
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
const agentLabels = {
  name: "Nom complet",
  phone: "Téléphone",
  email: "Adresse e-mail",
  password: "Mot de passe initial",
  active: "Statut du compte",
};
const agentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .union([z.string().trim().max(30).regex(/^[+\d\s().-]+$/, "numéro non valide"), z.literal("")])
    .default(""),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().max(128).optional(),
  active: z.boolean().default(true),
});
const passwordSchema = z.object({ password: z.string().max(128).optional() });

async function loadAgent(id) {
  if (!validId(id)) throw httpError(404, "Agent introuvable.");
  const agent = await MarketingAgent.findById(id);
  if (!agent) throw httpError(404, "Agent introuvable.");
  return agent;
}
async function loadProspect(id) {
  if (!validId(id)) throw httpError(404, "Prospect introuvable.");
  const prospect = await MarketingProspect.findById(id);
  if (!prospect) throw httpError(404, "Prospect introuvable.");
  return prospect;
}
async function assertFreeEmail(email, excludeId) {
  if (await MarketingAgent.exists({ email, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }))
    throw httpError(409, "Adresse e-mail : un autre agent utilise déjà cette adresse.");
}
// Mot de passe saisi par l’administrateur, ou mot de passe provisoire généré.
function choosePassword(value, email) {
  if (!value) return temporaryPassword(email.split("@")[0]);
  const problem = passwordProblem(value, { username: email.split("@")[0] });
  if (problem) throw httpError(400, `Mot de passe initial : ${problem}`);
  return value;
}
const publicAgent = (agent, counts = {}) => ({
  _id: agent._id,
  reference: agent.reference,
  name: agent.name,
  phone: agent.phone,
  email: agent.email,
  active: agent.active,
  mustChangePassword: agent.mustChangePassword,
  lastLoginAt: agent.lastLoginAt || null,
  createdAt: agent.createdAt,
  prospects: counts.total || 0,
  enrolled: counts.enrolled || 0,
});

export function createMarketingAdminRouter() {
  const router = Router();

  // ——— Agents marketing ———
  router.get(
    "/agents",
    wrap(AGENTS, "view", async (req, res) => {
      const filter = {};
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
      if (q)
        filter.$or = ["name", "phone", "email", "reference"].map((field) => ({
          [field]: { $regex: escapeRegex(q), $options: "i" },
        }));
      if (req.query.active === "true") filter.active = true;
      if (req.query.active === "false") filter.active = false;
      const agents = await MarketingAgent.find(filter).sort({ createdAt: 1 }).lean();
      const counts = await MarketingProspect.aggregate([
        { $match: { agentId: { $in: agents.map((agent) => agent._id) } } },
        {
          $group: {
            _id: "$agentId",
            total: { $sum: 1 },
            enrolled: { $sum: { $cond: [{ $eq: ["$status", "enrolled"] }, 1, 0] } },
          },
        },
      ]);
      const byId = new Map(counts.map((row) => [String(row._id), row]));
      res.json({
        items: agents.map((agent) => publicAgent(agent, byId.get(String(agent._id)))),
        total: agents.length,
        page: 1,
        pages: 1,
      });
    }),
  );
  router.post(
    "/agents",
    wrap(AGENTS, "create", async (req, res) => {
      const data = parseBody(agentSchema, req.body, agentLabels);
      await assertFreeEmail(data.email);
      const password = choosePassword(data.password, data.email);
      const agent = await MarketingAgent.create({
        reference: await nextNumber("AGT"),
        name: data.name,
        phone: data.phone,
        email: data.email,
        active: data.active,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        createdBy: adminActor(req.admin),
      });
      res.status(201).json({
        item: publicAgent(agent),
        // Affiché une seule fois à l’administrateur, jamais conservé en clair.
        ...(data.password ? {} : { temporaryPassword: password }),
      });
    }),
  );
  router.patch(
    "/agents/:id",
    wrap(AGENTS, "update", async (req, res) => {
      const agent = await loadAgent(req.params.id);
      const { password: _ignored, ...data } = parseBody(agentSchema.partial(), req.body, agentLabels);
      if (data.email && data.email !== agent.email) await assertFreeEmail(data.email, agent._id);
      Object.assign(agent, data);
      await agent.save();
      // Désactivé : l’agent est déconnecté immédiatement.
      if (data.active === false) await MarketingSession.deleteMany({ agentId: agent._id });
      res.json({ item: publicAgent(agent) });
    }),
  );
  // Réinitialisation sans connaître l’ancien mot de passe.
  router.post(
    "/agents/:id/password",
    wrap(AGENTS, "update", async (req, res) => {
      const agent = await loadAgent(req.params.id);
      const { password: value } = parseBody(passwordSchema, req.body || {}, agentLabels);
      const password = choosePassword(value, agent.email);
      agent.passwordHash = await hashPassword(password);
      agent.mustChangePassword = true;
      agent.passwordChangedAt = new Date();
      await agent.save();
      await MarketingSession.deleteMany({ agentId: agent._id });
      res.json({
        message: "Mot de passe réinitialisé. L’agent devra le changer à sa prochaine connexion.",
        email: agent.email,
        ...(value ? {} : { temporaryPassword: password }),
      });
    }),
  );
  router.delete(
    "/agents/:id",
    wrap(AGENTS, "delete", async (req, res) => {
      const agent = await loadAgent(req.params.id);
      if (await MarketingProspect.exists({ agentId: agent._id }))
        throw httpError(409, "Cet agent a collecté des prospects : désactivez son compte plutôt que de le supprimer.");
      await MarketingSession.deleteMany({ agentId: agent._id });
      await MarketingActivity.deleteMany({ agentId: agent._id });
      await agent.deleteOne();
      res.json({ deleted: true });
    }),
  );
  router.get(
    "/agents/:id/activity",
    wrap(AGENTS, "view", async (req, res) => {
      const agent = await loadAgent(req.params.id);
      const items = await MarketingActivity.find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("prospectId", "reference name")
        .lean();
      res.json({
        agent: publicAgent(agent),
        items: items.map((item) => ({
          _id: item._id,
          action: item.action,
          label: AGENT_ACTIONS[item.action],
          details: item.details,
          prospect: item.prospectId ? { reference: item.prospectId.reference, name: item.prospectId.name } : null,
          ip: item.ip,
          createdAt: item.createdAt,
        })),
      });
    }),
  );

  // ——— Prospects ———
  router.get(
    "/prospects",
    wrap(PROSPECTS, "view", async (req, res) => res.json(await listProspects(req.query))),
  );
  router.get(
    "/stats",
    wrap(PROSPECTS, "view", async (req, res) => res.json(await prospectStats(req.query))),
  );
  router.post(
    "/prospects",
    wrap(PROSPECTS, "create", async (req, res) => {
      const { agentId, ...rest } = req.body || {};
      const data = parseBody(prospectSchema, rest, prospectLabels);
      const agent = agentId ? await loadAgent(agentId) : null;
      const prospect = await createProspect(data, { by: adminActor(req.admin), agent });
      res.status(201).json({ item: publicProspect(prospect) });
    }),
  );
  router.patch(
    "/prospects/:id",
    wrap(PROSPECTS, "update", async (req, res) => {
      const prospect = await loadProspect(req.params.id);
      const { agentId, ...rest } = req.body || {};
      const data = parseBody(prospectSchema.omit({ status: true }).partial(), rest, prospectLabels);
      if (agentId !== undefined) {
        const agent = agentId ? await loadAgent(agentId) : null;
        prospect.agentId = agent?._id;
        prospect.agentName = agent?.name || "";
      }
      await updateProspect(prospect, data);
      res.json({ item: publicProspect(prospect) });
    }),
  );
  router.post(
    "/prospects/:id/status",
    wrap(PROSPECTS, "update", async (req, res) => {
      const prospect = await loadProspect(req.params.id);
      const data = parseBody(statusSchema, req.body, prospectLabels);
      await changeStatus(prospect, data, adminActor(req.admin));
      res.json({ item: publicProspect(prospect) });
    }),
  );
  router.post(
    "/prospects/:id/link",
    wrap(PROSPECTS, "update", async (req, res) => {
      const prospect = await loadProspect(req.params.id);
      const { registrationId, create } = req.body || {};
      await linkRegistration(prospect, { registrationId, create: create === true });
      res.json({ item: publicProspect(prospect) });
    }),
  );
  router.get(
    "/prospects/:id/history",
    wrap(PROSPECTS, "view", async (req, res) => {
      const prospect = await loadProspect(req.params.id);
      res.json({ item: publicProspect(prospect), items: await prospectHistory(prospect._id) });
    }),
  );
  router.delete(
    "/prospects/:id",
    wrap(PROSPECTS, "delete", async (req, res) => {
      const prospect = await loadProspect(req.params.id);
      await MarketingFollowup.deleteMany({ prospectId: prospect._id });
      await prospect.deleteOne();
      res.json({ deleted: true });
    }),
  );
  // Liste des agents pour les filtres et formulaires.
  router.get(
    "/agents-lookup",
    wrap(PROSPECTS, "view", async (_req, res) => {
      const items = await MarketingAgent.find().select("reference name active").sort({ name: 1 }).lean();
      res.json({ items });
    }),
  );
  return router;
}

