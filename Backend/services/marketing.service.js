import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import {
  MarketingProspect,
  MarketingFollowup,
  MarketingActivity,
} from "../models/marketing.models.js";
import { Registration } from "../models/platform.models.js";
import { Course } from "../models/index.js";
import { nextNumber } from "../models/system.models.js";
import {
  PROSPECT_STATUS,
  PROSPECT_SOURCES,
  OPEN_STATUSES,
  INTERESTED_STATUSES,
  phoneKey,
} from "../config/marketing.js";
import { httpError, escapeRegex, v } from "./crud.js";
import { clientIp } from "./security.service.js";

export const prospectLabels = {
  name: "Nom complet",
  phone: "Téléphone",
  email: "E-mail",
  courseId: "Formation",
  status: "Statut",
  source: "Source",
  notes: "Observations",
  nextFollowUp: "Prochaine relance",
  agentId: "Agent marketing",
  note: "Commentaire",
};
const email = z
  .union([z.string().trim().toLowerCase().email().max(254), z.literal("")])
  .default("");
export const prospectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+\d\s().-]+$/, "numéro non valide")
    .refine((value) => phoneKey(value).length >= 6, "numéro non valide"),
  email,
  courseId: v.required(80),
  status: z.enum(Object.keys(PROSPECT_STATUS)).default("new"),
  source: z.enum(Object.keys(PROSPECT_SOURCES)).default("field"),
  notes: v.text(2000),
  consent: z.boolean().default(false),
  nextFollowUp: v.optionalDay,
});
export const statusSchema = z.object({
  status: z.enum(Object.keys(PROSPECT_STATUS)),
  note: v.text(1000),
  nextFollowUp: v.optionalDay,
});

export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Djibouti" }).format(new Date());

export async function courseTitle(courseId) {
  const course = await Course.findOne({ id: courseId }).select("title").lean();
  if (!course) throw httpError(400, "Formation : choisissez une formation de la liste.");
  return course.title;
}

// Un même téléphone ou une même adresse e-mail n’est enregistré qu’une fois.
export async function assertNoDuplicate({ phone, email: mail }, excludeId, reveal = true) {
  const or = [];
  if (phone) or.push({ phoneKey: phoneKey(phone) });
  if (mail) or.push({ email: mail });
  if (!or.length) return;
  const found = await MarketingProspect.findOne({
    $or: or,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("reference name agentName phoneKey")
    .lean();
  if (found && !reveal)
    throw httpError(409, "Ce prospect est déjà enregistré dans le système (même téléphone ou e-mail).");
  if (found)
    throw httpError(
      409,
      `Ce prospect est déjà enregistré : ${found.name} (${found.reference}${found.agentName ? `, collecté par ${found.agentName}` : ""}). Vérifiez le ${found.phoneKey === phoneKey(phone) ? "téléphone" : "e-mail"}.`,
    );
}

export const agentActor = (agent) => ({ kind: "agent", id: agent._id, name: agent.name });
export const adminActor = (admin) => ({ kind: "admin", id: admin._id, name: admin.name });

export async function logActivity(agentId, action, req, { prospectId, details = "" } = {}) {
  if (!agentId) return;
  await MarketingActivity.create({
    agentId,
    action,
    prospectId,
    details: details.slice(0, 300),
    ip: clientIp(req),
  });
}

export async function createProspect(data, { by, agent, reveal = true }) {
  await assertNoDuplicate(data, undefined, reveal);
  const prospect = await MarketingProspect.create({
    ...data,
    reference: await nextNumber("PRO"),
    phoneKey: phoneKey(data.phone),
    courseTitle: await courseTitle(data.courseId),
    agentId: agent?._id,
    agentName: agent?.name || "",
    statusChangedAt: new Date(),
    createdBy: by,
  });
  await MarketingFollowup.create({
    prospectId: prospect._id,
    from: "",
    to: prospect.status,
    note: "Prospect enregistré.",
    nextFollowUp: prospect.nextFollowUp,
    by,
  });
  if (prospect.status === "enrolled") await autoLink(prospect);
  return prospect;
}

export async function updateProspect(prospect, data, reveal = true) {
  await assertNoDuplicate(
    { phone: data.phone ?? prospect.phone, email: data.email ?? prospect.email },
    prospect._id,
    reveal,
  );
  if (data.courseId && data.courseId !== prospect.courseId)
    prospect.courseTitle = await courseTitle(data.courseId);
  const { status: _ignored, ...rest } = data;
  Object.assign(prospect, rest);
  if (data.phone) prospect.phoneKey = phoneKey(data.phone);
  await prospect.save();
  return prospect;
}

// Chaque changement de statut est daté et historisé avec son auteur.
export async function changeStatus(prospect, { status, note, nextFollowUp }, by) {
  const from = prospect.status;
  if (from === status && !note && nextFollowUp === undefined)
    throw httpError(400, "Choisissez un autre statut ou ajoutez un commentaire.");
  prospect.status = status;
  if (from !== status) prospect.statusChangedAt = new Date();
  prospect.nextFollowUp = OPEN_STATUSES.includes(status) ? nextFollowUp : undefined;
  await prospect.save();
  await MarketingFollowup.create({
    prospectId: prospect._id,
    from,
    to: status,
    note,
    nextFollowUp: prospect.nextFollowUp,
    by,
  });
  if (status === "enrolled") await autoLink(prospect);
  return prospect;
}

// Prospect devenu student : relié à l’inscrit existant (même téléphone ou e-mail).
async function autoLink(prospect) {
  if (prospect.registrationId) return;
  const found = await findRegistration(prospect);
  if (!found) return;
  prospect.registrationId = found._id;
  prospect.registrationReference = found.reference;
  await prospect.save();
}
function findRegistration(prospect) {
  const digits = phoneKey(prospect.phone).split("");
  const or = [{ phone: { $regex: `${digits.map(escapeRegex).join("\\D*")}$` } }];
  if (prospect.email) or.push({ email: prospect.email });
  return Registration.findOne({ $or: or }).sort({ createdAt: -1 }).select("reference").lean();
}

// Relier à un inscrit choisi, ou créer l’inscrit à partir du prospect.
export async function linkRegistration(prospect, { registrationId, create }) {
  let registration;
  if (registrationId) {
    if (!mongoose.isValidObjectId(registrationId))
      throw httpError(400, "Inscrit introuvable.");
    registration = await Registration.findById(registrationId).select("reference").lean();
    if (!registration) throw httpError(400, "Inscrit introuvable.");
  } else if (create) {
    registration = (await findRegistration(prospect)) ||
      (await Registration.create({
        reference: `AH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        name: prospect.name,
        phone: prospect.phone,
        email: prospect.email,
        courseId: prospect.courseId,
        message: `Prospect ${prospect.reference}${prospect.agentName ? ` — agent ${prospect.agentName}` : ""}. ${prospect.notes}`.trim().slice(0, 2000),
        consent: prospect.consent,
        status: "confirmed",
      }));
  } else throw httpError(400, "Choisissez l’inscrit à relier.");
  prospect.registrationId = registration._id;
  prospect.registrationReference = registration.reference;
  await prospect.save();
  return prospect;
}

export const publicProspect = (item) => ({
  _id: item._id,
  reference: item.reference,
  name: item.name,
  phone: item.phone,
  email: item.email,
  courseId: item.courseId,
  courseTitle: item.courseTitle,
  status: item.status,
  source: item.source,
  notes: item.notes,
  consent: item.consent,
  nextFollowUp: item.nextFollowUp || "",
  agentId: item.agentId || null,
  agentName: item.agentName,
  registrationId: item.registrationId || null,
  registrationReference: item.registrationReference || "",
  statusChangedAt: item.statusChangedAt,
  createdAt: item.createdAt,
});

// Filtres communs (administration et portail) lus dans la requête.
export function prospectFilter(query, base = {}) {
  const filter = { ...base };
  const q = typeof query.q === "string" ? query.q.slice(0, 100).trim() : "";
  if (q)
    filter.$or = ["name", "phone", "email", "reference", "courseTitle"].map((field) => ({
      [field]: { $regex: escapeRegex(q), $options: "i" },
    }));
  if (PROSPECT_STATUS[query.status]) filter.status = query.status;
  if (query.status === "followup") {
    filter.status = { $in: OPEN_STATUSES };
    filter.nextFollowUp = { $lte: today() };
  }
  if (PROSPECT_SOURCES[query.source]) filter.source = query.source;
  if (typeof query.courseId === "string" && query.courseId) filter.courseId = query.courseId.slice(0, 80);
  if (!base.agentId && mongoose.isValidObjectId(query.agentId)) filter.agentId = new mongoose.Types.ObjectId(query.agentId);
  if (query.agentId === "none") filter.agentId = null;
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.from || "")) range.$gte = new Date(`${query.from}T00:00:00+03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.to || "")) range.$lte = new Date(`${query.to}T23:59:59.999+03:00`);
  if (Object.keys(range).length) filter.createdAt = range;
  return filter;
}

export async function listProspects(query, base) {
  const all = query.all === "1";
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = all ? 5000 : Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const filter = prospectFilter(query, base);
  const [items, total] = await Promise.all([
    MarketingProspect.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MarketingProspect.countDocuments(filter),
  ]);
  return { items: items.map(publicProspect), total, page, pages: Math.ceil(total / limit) || 1 };
}

// Indicateurs : total, intérêt confirmé, inscriptions (conversion), relances.
export async function prospectStats(query, base = {}) {
  const filter = prospectFilter({ ...query, status: "" , q: "" }, base);
  const day = today();
  const [byStatus, followUps, byAgent] = await Promise.all([
    MarketingProspect.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    MarketingProspect.countDocuments({
      ...filter,
      status: { $in: OPEN_STATUSES },
      $or: [{ nextFollowUp: { $lte: day } }, { status: "new", nextFollowUp: null }],
    }),
    base.agentId
      ? []
      : MarketingProspect.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$agentId",
              name: { $last: "$agentName" },
              total: { $sum: 1 },
              interested: { $sum: { $cond: [{ $in: ["$status", INTERESTED_STATUSES] }, 1, 0] } },
              enrolled: { $sum: { $cond: [{ $eq: ["$status", "enrolled"] }, 1, 0] } },
              lost: { $sum: { $cond: [{ $eq: ["$status", "not_interested"] }, 1, 0] } },
            },
          },
          { $sort: { enrolled: -1, total: -1 } },
        ]),
  ]);
  const counts = Object.fromEntries(Object.keys(PROSPECT_STATUS).map((key) => [key, 0]));
  for (const row of byStatus) counts[row._id] = row.count;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const interested = INTERESTED_STATUSES.reduce((sum, key) => sum + counts[key], 0);
  const rate = (value, of) => (of ? Math.round((value / of) * 1000) / 10 : 0);
  return {
    total,
    interested,
    enrolled: counts.enrolled,
    conversion: rate(counts.enrolled, total),
    followUps,
    byStatus: counts,
    byAgent: byAgent.map((row) => ({
      agentId: row._id,
      name: row.name || "Administration",
      total: row.total,
      interested: row.interested,
      enrolled: row.enrolled,
      lost: row.lost,
      conversion: rate(row.enrolled, row.total),
    })),
  };
}

export async function prospectHistory(prospectId) {
  const items = await MarketingFollowup.find({ prospectId }).sort({ createdAt: -1 }).limit(100).lean();
  return items.map((item) => ({
    _id: item._id,
    from: item.from,
    to: item.to,
    note: item.note,
    nextFollowUp: item.nextFollowUp || "",
    by: item.by,
    createdAt: item.createdAt,
  }));
}
