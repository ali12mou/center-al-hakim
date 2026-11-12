import { Router } from "express";
import { z } from "zod";
import {
  StudentUser,
  StudentSession,
  Lesson,
  StudentAttendance,
  Grade,
  Announcement,
  LESSON_KINDS,
  STUDENT_ATTENDANCE,
} from "../models/student.models.js";
import { StudentAccount } from "../models/finance.models.js";
import { permit } from "../middleware/admin.middleware.js";
import { canModule } from "../config/permissions.js";
import { hashPassword, temporaryPassword } from "../services/password.service.js";
import {
  crudRoutes,
  parseBody,
  sendError,
  httpError,
  actor,
  escapeRegex,
  validId,
  v,
} from "../services/crud.js";

// Administration de l’espace students : identifiants de l’application, cours,
// présences, notes et annonces. Monté sous /api/admin/eleves (session admin).
const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
const labels = {
  name: "Nom",
  username: "Identifiant",
  accountIds: "Dossiers",
  studentAccountId: "Student",
  courseId: "Formation",
  title: "Titre",
  kind: "Type",
  fileUrl: "Document",
  link: "Lien",
  date: "Date",
  status: "Statut",
  score: "Note",
  maxScore: "Barème",
  body: "Texte",
};
const byAccount = {
  studentAccountId: (value) => (validId(value) ? { studentAccountId: value } : {}),
};
const byCourse = { courseId: (value) => ({ courseId: value }) };
const privateFile = z
  .string()
  .max(200)
  .default("")
  .refine(
    (value) => !value || /^\/api\/admin\/files\/[0-9a-f-]{36}\.(pdf|png|jpg|gif|webp)$/.test(value),
    "document non valide",
  );
const httpsLink = z
  .string()
  .trim()
  .max(1000)
  .default("")
  .refine((value) => !value || /^https?:\/\//i.test(value), "le lien doit commencer par https://");

async function loadAccount(id) {
  const account = await StudentAccount.findById(id).select("studentName courseId status").lean();
  if (!account) throw httpError(400, "Le dossier du student est introuvable.");
  return account;
}

// Identifiant de connexion lisible : le téléphone, sinon le n° de dossier.
async function freeUsername(account) {
  const digits = (account.phone || "").replace(/\D/g, "");
  const candidates = [
    digits.length >= 6 ? digits.slice(-8) : "",
    account.reference.toLowerCase(),
  ].filter(Boolean);
  for (const candidate of candidates)
    if (!(await StudentUser.exists({ username: candidate }))) return candidate;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${candidates.at(-1)}-${index}`;
    if (!(await StudentUser.exists({ username: candidate }))) return candidate;
  }
  throw httpError(409, "Impossible de trouver un identifiant libre. Saisissez-en un.");
}

const accessSchema = z.object({
  name: v.text(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(50)
    .regex(/^[a-z0-9._-]*$/, "lettres, chiffres, point, tiret uniquement")
    .default(""),
  accountIds: z.array(v.id).min(1).max(20),
  phone: v.text(30),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  active: z.boolean().default(true),
});
const lessonSchema = z.object({
  courseId: v.required(80),
  title: v.required(200),
  kind: z.enum(LESSON_KINDS).default("lesson"),
  description: v.text(2000),
  body: v.text(15000),
  fileUrl: privateFile,
  link: httpsLink,
  date: v.optionalDay,
  order: z.coerce.number().int().min(0).max(10000).default(0),
  published: z.boolean().default(true),
});
const attendanceSchema = z.object({
  studentAccountId: v.id,
  date: v.day,
  status: z.enum(STUDENT_ATTENDANCE).default("present"),
  notes: v.text(500),
});
const gradeSchema = z.object({
  studentAccountId: v.id,
  title: v.required(150),
  date: v.day,
  score: z.coerce.number().min(0).max(1000),
  maxScore: z.coerce.number().min(1).max(1000).default(20),
  comment: v.text(1000),
  published: z.boolean().default(true),
});
const announcementSchema = z.object({
  title: v.required(200),
  body: v.text(5000),
  courseId: v.text(80),
  date: v.day,
  pinned: z.boolean().default(false),
  published: z.boolean().default(true),
});

export function createStudentsAdminRouter() {
  const router = Router();
  const anySection = (req, res, next) =>
    canModule(req.admin, "eleves")
      ? next()
      : res.status(403).json({ error: "Accès non autorisé.", forbidden: true });

  // Students (dossiers financiers) pour les listes de choix et l’appel.
  router.get(
    "/students",
    anySection,
    wrap(async (req, res) => {
      const filter = { status: { $ne: "cancelled" } };
      if (typeof req.query.courseId === "string" && req.query.courseId)
        filter.courseId = req.query.courseId.slice(0, 80);
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
      if (q)
        filter.$or = ["studentName", "phone", "reference"].map((field) => ({
          [field]: { $regex: escapeRegex(q), $options: "i" },
        }));
      const accounts = await StudentAccount.find(filter)
        .select("reference studentName phone email courseId courseTitle status startDate")
        .sort({ studentName: 1 })
        .limit(req.query.all === "1" ? 2000 : 300)
        .lean();
      const users = await StudentUser.find({ accountIds: { $in: accounts.map((item) => item._id) } })
        .select("accountIds username active")
        .lean();
      res.json({
        items: accounts.map((account) => {
          const user = users.find((item) => item.accountIds.some((id) => id.equals(account._id)));
          return { ...account, access: user ? { id: user._id, username: user.username, active: user.active } : null };
        }),
      });
    }),
  );

  // Identifiants de l’application.
  // L’empreinte du mot de passe ne quitte jamais le serveur, même juste après la création.
  const accessSerialize = async ({ passwordHash, ...item }) => {
    const accounts = await StudentAccount.find({ _id: { $in: item.accountIds } })
      .select("reference courseTitle status")
      .lean();
    return { ...item, accounts };
  };
  crudRoutes(router, {
    path: "/access",
    model: StudentUser,
    schema: accessSchema,
    labels,
    section: "eleves.access",
    search: ["name", "username", "phone", "email"],
    filters: { active: (value) => ({ active: value === "true" }) },
    sort: { active: -1, name: 1 },
    readOnly: ["username", "passwordHash", "mustChangePassword"],
    only: ["list", "detail", "update"],
    serialize: accessSerialize,
    async prepare(data, { record }) {
      if (data.accountIds)
        for (const id of data.accountIds) await loadAccount(id);
      if (record && data.active === false && record.active)
        await StudentSession.deleteMany({ userId: record._id });
      return data;
    },
  });
  router.post(
    "/access",
    permit("eleves.access", "create"),
    wrap(async (req, res) => {
      const data = parseBody(accessSchema, req.body, labels);
      const accounts = await StudentAccount.find({ _id: { $in: data.accountIds } }).lean();
      if (accounts.length !== new Set(data.accountIds).size)
        throw httpError(400, "Un des dossiers choisis est introuvable.");
      const taken = await StudentUser.findOne({ accountIds: { $in: data.accountIds } })
        .select("username")
        .lean();
      if (taken)
        throw httpError(409, `Ce student a déjà un accès (identifiant « ${taken.username} »). Utilisez « Nouveau mot de passe ».`);
      const first = accounts[0];
      const username = data.username || (await freeUsername(first));
      if (await StudentUser.exists({ username }))
        throw httpError(409, `L’identifiant « ${username} » est déjà utilisé.`);
      const password = temporaryPassword(username);
      const user = await StudentUser.create({
        name: data.name || first.studentName,
        username,
        phone: data.phone || first.phone || "",
        email: data.email || first.email || "",
        accountIds: data.accountIds,
        active: data.active,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        createdBy: actor(req),
      });
      res.status(201).json({
        item: await accessSerialize(user.toObject()),
        temporaryPassword: password,
      });
    }),
  );
  router.post(
    "/access/:id/reset",
    permit("eleves.access", "update"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const user = await StudentUser.findById(req.params.id);
      if (!user) throw httpError(404, "Accès introuvable.");
      const password = temporaryPassword(user.username);
      user.passwordHash = await hashPassword(password);
      user.mustChangePassword = true;
      await user.save();
      await StudentSession.deleteMany({ userId: user._id });
      res.json({ username: user.username, temporaryPassword: password });
    }),
  );
  router.delete(
    "/access/:id",
    permit("eleves.access", "delete"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const user = await StudentUser.findByIdAndDelete(req.params.id);
      if (!user) throw httpError(404, "Accès introuvable.");
      await StudentSession.deleteMany({ userId: user._id });
      res.json({ message: "Accès supprimé. Le dossier du student est conservé." });
    }),
  );

  // Cours, documents, vidéos et liens par formation.
  crudRoutes(router, {
    path: "/lessons",
    model: Lesson,
    schema: lessonSchema,
    labels,
    section: "eleves.lessons",
    search: ["title", "description"],
    filters: { ...byCourse, published: (value) => ({ published: value === "true" }) },
    sort: { courseId: 1, order: 1, date: -1, createdAt: -1 },
    readOnly: ["createdBy"],
    async prepare(data, { req, record }) {
      if (!record) data.createdBy = actor(req);
      const merged = { ...(record?.toObject() || {}), ...data };
      if (merged.kind === "document" && !merged.fileUrl)
        throw httpError(400, "Joignez le document (PDF ou image).");
      if (["video", "link"].includes(merged.kind) && !merged.link)
        throw httpError(400, "Indiquez le lien (https://…).");
      return data;
    },
  });

  // Présences des students : saisie unitaire ou appel d’une formation pour une date.
  crudRoutes(router, {
    path: "/attendance",
    model: StudentAttendance,
    schema: attendanceSchema,
    labels,
    section: "eleves.attendance",
    search: ["studentName"],
    dateField: "date",
    filters: { ...byAccount, ...byCourse, status: (value) => ({ status: value }) },
    sort: { date: -1, studentName: 1 },
    readOnly: ["recordedBy", "studentName", "courseId"],
    async prepare(data, { req, record }) {
      const accountId = data.studentAccountId || record?.studentAccountId;
      const date = data.date || record?.date;
      if (data.studentAccountId) {
        const account = await loadAccount(data.studentAccountId);
        data.studentName = account.studentName;
        data.courseId = account.courseId;
      }
      if (
        await StudentAttendance.exists({
          studentAccountId: accountId,
          date,
          ...(record ? { _id: { $ne: record._id } } : {}),
        })
      )
        throw httpError(409, "La présence de ce student est déjà saisie pour cette date.");
      data.recordedBy = actor(req);
      return data;
    },
  });
  router.get(
    "/roll",
    permit("eleves.attendance", "view"),
    wrap(async (req, res) => {
      const courseId = typeof req.query.courseId === "string" ? req.query.courseId.slice(0, 80) : "";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : null;
      if (!courseId || !date) throw httpError(400, "Choisissez une formation et une date.");
      const accounts = await StudentAccount.find({ courseId, status: { $ne: "cancelled" } })
        .select("reference studentName phone")
        .sort({ studentName: 1 })
        .lean();
      const marks = await StudentAttendance.find({
        studentAccountId: { $in: accounts.map((item) => item._id) },
        date,
      }).lean();
      res.json({
        items: accounts.map((account) => {
          const mark = marks.find((item) => item.studentAccountId.equals(account._id));
          return { ...account, status: mark?.status || "", notes: mark?.notes || "" };
        }),
      });
    }),
  );
  router.post(
    "/roll",
    permit("eleves.attendance", "create"),
    wrap(async (req, res) => {
      const { courseId, date, entries } = parseBody(
        z.object({
          courseId: v.required(80),
          date: v.day,
          entries: z
            .array(
              z.object({
                studentAccountId: v.id,
                status: z.enum(STUDENT_ATTENDANCE),
                notes: v.text(500),
              }),
            )
            .min(1)
            .max(500),
        }),
        req.body,
        labels,
      );
      const accounts = await StudentAccount.find({
        _id: { $in: entries.map((entry) => entry.studentAccountId) },
        courseId,
      })
        .select("studentName courseId")
        .lean();
      const by = actor(req);
      const operations = entries
        .map((entry) => {
          const account = accounts.find((item) => item._id.equals(entry.studentAccountId));
          if (!account) return null;
          return {
            updateOne: {
              filter: { studentAccountId: account._id, date },
              update: {
                $set: {
                  status: entry.status,
                  notes: entry.notes,
                  studentName: account.studentName,
                  courseId: account.courseId,
                  recordedBy: by,
                },
              },
              upsert: true,
            },
          };
        })
        .filter(Boolean);
      if (operations.length) await StudentAttendance.bulkWrite(operations);
      res.json({ saved: operations.length });
    }),
  );

  // Notes : saisie unitaire ou pour toute une formation (même évaluation).
  crudRoutes(router, {
    path: "/grades",
    model: Grade,
    schema: gradeSchema,
    labels,
    section: "eleves.grades",
    search: ["studentName", "title"],
    dateField: "date",
    filters: { ...byAccount, ...byCourse },
    sort: { date: -1, title: 1, studentName: 1 },
    readOnly: ["recordedBy", "studentName", "courseId"],
    async prepare(data, { req, record }) {
      if (data.studentAccountId) {
        const account = await loadAccount(data.studentAccountId);
        data.studentName = account.studentName;
        data.courseId = account.courseId;
      }
      const score = data.score ?? record?.score;
      const max = data.maxScore ?? record?.maxScore ?? 20;
      if (score > max) throw httpError(400, `La note (${score}) dépasse le barème (${max}).`);
      data.recordedBy = actor(req);
      return data;
    },
  });
  router.post(
    "/grades/batch",
    permit("eleves.grades", "create"),
    wrap(async (req, res) => {
      const { courseId, title, date, maxScore, published, entries } = parseBody(
        z.object({
          courseId: v.required(80),
          title: v.required(150),
          date: v.day,
          maxScore: z.coerce.number().min(1).max(1000).default(20),
          published: z.boolean().default(true),
          entries: z
            .array(
              z.object({
                studentAccountId: v.id,
                score: z.coerce.number().min(0).max(1000),
                comment: v.text(1000),
              }),
            )
            .min(1)
            .max(500),
        }),
        req.body,
        labels,
      );
      const over = entries.find((entry) => entry.score > maxScore);
      if (over) throw httpError(400, `Une note (${over.score}) dépasse le barème (${maxScore}).`);
      const accounts = await StudentAccount.find({
        _id: { $in: entries.map((entry) => entry.studentAccountId) },
        courseId,
      })
        .select("studentName courseId")
        .lean();
      const by = actor(req);
      const docs = entries
        .map((entry) => {
          const account = accounts.find((item) => item._id.equals(entry.studentAccountId));
          return account && {
            studentAccountId: account._id,
            studentName: account.studentName,
            courseId: account.courseId,
            title,
            date,
            score: entry.score,
            maxScore,
            comment: entry.comment,
            published,
            recordedBy: by,
          };
        })
        .filter(Boolean);
      if (docs.length) await Grade.insertMany(docs);
      res.status(201).json({ saved: docs.length });
    }),
  );

  // Annonces (toutes formations ou une seule).
  crudRoutes(router, {
    path: "/announcements",
    model: Announcement,
    schema: announcementSchema,
    labels,
    section: "eleves.announcements",
    search: ["title", "body"],
    dateField: "date",
    filters: { ...byCourse, published: (value) => ({ published: value === "true" }) },
    sort: { pinned: -1, date: -1, createdAt: -1 },
    readOnly: ["createdBy"],
    async prepare(data, { req, record }) {
      if (!record) data.createdBy = actor(req);
      return data;
    },
  });

  return router;
}
