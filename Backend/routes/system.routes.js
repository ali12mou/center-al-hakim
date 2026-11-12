import { Router } from "express";
import { z } from "zod";
import {
  AdminUser,
  AdminSession,
  AdminAudit,
  LoginThrottle,
  Registration,
  Contact,
  AssessmentAttempt,
  auditEvents,
} from "../models/platform.models.js";
import { Course } from "../models/index.js";
import { ApiLog, SiteVisit } from "../models/system.models.js";
import { Staff } from "../models/hr.models.js";
import {
  FinanceAccount,
  FeeRate,
  Discount,
  ExpenseCategory,
  StudentAccount,
  Payment,
  Expense,
  StaffPayment,
} from "../models/finance.models.js";
import { requireSuperAdmin } from "../middleware/admin.middleware.js";
import { can, canModule, cleanPermissions } from "../config/permissions.js";
import { hashPassword, temporaryPassword } from "../services/password.service.js";
import {
  SESSION_IDLE,
  audit,
  clearLoginFailures,
  describeAgent,
} from "../services/security.service.js";
import { resourceModels } from "../services/platform.service.js";
import { getSettings } from "../services/settings.service.js";
import { currentMonth, today } from "../services/dates.js";
import {
  parseBody,
  sendError,
  httpError,
  escapeRegex,
  validId,
} from "../services/crud.js";

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
const userFields = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  role: z.enum(["admin", "staff"]).default("staff"),
  permissions: z.array(z.string().max(80)).max(300).default([]),
  jobTitle: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(30).default(""),
  active: z.boolean().default(true),
};
const createUserSchema = z.object({
  ...userFields,
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "lettres, chiffres, point, tiret ou souligné"),
});
const updateUserSchema = z.object(userFields).partial();
const labels = {
  name: "Nom complet",
  email: "E-mail",
  username: "Nom d’utilisateur",
  role: "Rôle",
  permissions: "Permissions",
};
const activeSession = () => ({
  expiresAt: { $gt: new Date() },
  lastSeenAt: { $gt: new Date(Date.now() - SESSION_IDLE) },
});
const userView = (user, sessions = 0) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  permissions: user.role === "admin" ? [] : user.permissions || [],
  jobTitle: user.jobTitle || "",
  phone: user.phone || "",
  active: user.active !== false,
  mustChangePassword: Boolean(user.mustChangePassword),
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  activeSessions: sessions,
});
async function otherActiveAdmins(userId) {
  return AdminUser.countDocuments({ role: "admin", active: { $ne: false }, _id: { $ne: userId } });
}
const range = (req) => {
  const day = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
  return {
    from: day(req.query.from) ? req.query.from : `${currentMonth()}-01`,
    to: day(req.query.to) ? req.query.to : today(),
  };
};
// Les dates de création sont en UTC ; la journée de Djibouti commence à 21 h UTC la veille.
const utcRange = ({ from, to }) => ({
  $gte: new Date(`${from}T00:00:00+03:00`),
  $lte: new Date(`${to}T23:59:59.999+03:00`),
});

export function createSystemRouter() {
  const router = Router();
  router.use(requireSuperAdmin);

  // Comptes d’accès à l’administration.
  router.get("/users", wrap(async (_req, res) => {
    const [users, sessions] = await Promise.all([
      AdminUser.find().sort({ role: 1, name: 1 }).lean(),
      AdminSession.aggregate([{ $match: activeSession() }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
    ]);
    const count = (id) => sessions.find((row) => String(row._id) === String(id))?.count || 0;
    res.json({ items: users.map((user) => userView(user, count(user._id))) });
  }));
  router.post("/users", wrap(async (req, res) => {
    const data = parseBody(createUserSchema, req.body, labels);
    data.username = data.username.toLowerCase();
    if (await AdminUser.exists({ username: data.username }))
      throw httpError(409, "Ce nom d’utilisateur est déjà utilisé.");
    const password = temporaryPassword(data.username);
    const user = await AdminUser.create({
      ...data,
      permissions: data.role === "admin" ? [] : cleanPermissions(data.permissions),
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      passwordChangedAt: new Date(),
      createdBy: req.admin._id,
    });
    await audit("user_created", req, { user: req.admin, target: user.username });
    res.status(201).json({ item: userView(user), temporaryPassword: password });
  }));
  router.patch("/users/:id", wrap(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
    const data = parseBody(updateUserSchema, req.body, labels);
    const user = await AdminUser.findById(req.params.id);
    if (!user) throw httpError(404, "Compte introuvable.");
    const self = user._id.equals(req.admin._id);
    const demoted = user.role === "admin" && (data.role === "staff" || data.active === false);
    if (self && demoted)
      throw httpError(409, "Vous ne pouvez pas retirer vos propres droits d’administrateur général.");
    if (demoted && !(await otherActiveAdmins(user._id)))
      throw httpError(409, "Il doit rester au moins un administrateur général actif.");
    const wasActive = user.active !== false;
    if ("permissions" in data) data.permissions = cleanPermissions(data.permissions);
    user.set(data);
    if (user.role === "admin") user.permissions = [];
    await user.save();
    if (wasActive && user.active === false) {
      await AdminSession.deleteMany({ userId: user._id });
      await audit("user_disabled", req, { user: req.admin, target: user.username });
    } else if (!wasActive && user.active !== false)
      await audit("user_enabled", req, { user: req.admin, target: user.username });
    else await audit("user_updated", req, { user: req.admin, target: user.username });
    res.json({ item: userView(user) });
  }));
  router.post("/users/:id/reset-password", wrap(async (req, res) => {
    const user = await AdminUser.findById(validId(req.params.id) ? req.params.id : null);
    if (!user) throw httpError(404, "Compte introuvable.");
    if (user._id.equals(req.admin._id))
      throw httpError(409, "Pour votre propre compte, utilisez « Sécurité du compte ».");
    const password = temporaryPassword(user.username);
    user.set({ passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date() });
    await user.save();
    await AdminSession.deleteMany({ userId: user._id });
    await clearLoginFailures(user.username);
    await audit("user_password_reset", req, { user: req.admin, target: user.username });
    res.json({ temporaryPassword: password });
  }));
  router.post("/users/:id/revoke-sessions", wrap(async (req, res) => {
    const user = await AdminUser.findById(validId(req.params.id) ? req.params.id : null);
    if (!user) throw httpError(404, "Compte introuvable.");
    const filter = { userId: user._id };
    if (user._id.equals(req.admin._id)) filter._id = { $ne: req.adminSession._id };
    const { deletedCount } = await AdminSession.deleteMany(filter);
    await audit("session_revoked", req, { user: req.admin, target: user.username });
    res.json({ revoked: deletedCount });
  }));
  router.delete("/users/:id", wrap(async (req, res) => {
    const user = await AdminUser.findById(validId(req.params.id) ? req.params.id : null);
    if (!user) throw httpError(404, "Compte introuvable.");
    if (user._id.equals(req.admin._id)) throw httpError(409, "Vous ne pouvez pas supprimer votre propre compte.");
    if (user.role === "admin" && !(await otherActiveAdmins(user._id)))
      throw httpError(409, "Il doit rester au moins un administrateur général actif.");
    await AdminSession.deleteMany({ userId: user._id });
    await user.deleteOne();
    await audit("user_deleted", req, { user: req.admin, target: user.username });
    res.json({ message: "Compte supprimé." });
  }));

  // Sécurité de toute l’application.
  router.get("/security/overview", wrap(async (_req, res) => {
    const day = new Date(Date.now() - 24 * 3_600_000);
    const week = new Date(Date.now() - 7 * 24 * 3_600_000);
    const [
      users,
      sessions,
      failures24h,
      failures7d,
      locked,
      calls24h,
      errors24h,
      forbidden24h,
      endpoints,
      perUser,
      failuresByIp,
      logins,
    ] = await Promise.all([
      AdminUser.aggregate([{ $group: { _id: { role: "$role", active: { $ne: ["$active", false] } }, count: { $sum: 1 } } }]),
      AdminSession.countDocuments(activeSession()),
      AdminAudit.countDocuments({ event: { $in: ["login_failure", "login_locked"] }, createdAt: { $gte: day } }),
      AdminAudit.countDocuments({ event: { $in: ["login_failure", "login_locked"] }, createdAt: { $gte: week } }),
      LoginThrottle.countDocuments({ lockedUntil: { $gt: new Date() } }),
      ApiLog.countDocuments({ createdAt: { $gte: day } }),
      ApiLog.countDocuments({ createdAt: { $gte: day }, status: { $gte: 500 } }),
      ApiLog.countDocuments({ createdAt: { $gte: day }, status: { $in: [401, 403] } }),
      ApiLog.aggregate([
        { $match: { createdAt: { $gte: week } } },
        { $group: { _id: { method: "$method", path: "$path" }, count: { $sum: 1 }, errors: { $sum: { $cond: [{ $gte: ["$status", 400] }, 1, 0] } }, ms: { $avg: "$ms" } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      ApiLog.aggregate([
        { $match: { createdAt: { $gte: week }, username: { $ne: "" } } },
        { $group: { _id: "$username", count: { $sum: 1 }, writes: { $sum: { $cond: [{ $in: ["$method", ["POST", "PATCH", "PUT", "DELETE"]] }, 1, 0] } }, last: { $max: "$createdAt" } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      AdminAudit.aggregate([
        { $match: { event: { $in: ["login_failure", "login_locked"] }, createdAt: { $gte: week } } },
        { $group: { _id: "$ip", count: { $sum: 1 }, last: { $max: "$createdAt" } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      AdminAudit.find({ event: "login_success" }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    const countUsers = (filter) =>
      users.filter((row) => filter(row._id)).reduce((sum, row) => sum + row.count, 0);
    res.json({
      users: {
        total: countUsers(() => true),
        active: countUsers((key) => key.active),
        admins: countUsers((key) => key.role === "admin" && key.active),
      },
      sessions,
      failures24h,
      failures7d,
      locked,
      calls24h,
      errors24h,
      forbidden24h,
      endpoints: endpoints.map((row) => ({ ...row._id, count: row.count, errors: row.errors, ms: Math.round(row.ms) })),
      perUser: perUser.map((row) => ({ username: row._id, count: row.count, writes: row.writes, last: row.last })),
      failuresByIp: failuresByIp.map((row) => ({ ip: row._id || "inconnue", count: row.count, last: row.last })),
      logins: logins.map((event) => ({
        id: event._id,
        username: event.username,
        ip: event.ip,
        device: describeAgent(event.userAgent),
        createdAt: event.createdAt,
      })),
    });
  }));
  router.get("/security/events", wrap(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const filter = {};
    if (auditEvents.includes(req.query.event)) filter.event = req.query.event;
    if (typeof req.query.username === "string" && req.query.username)
      filter.$or = [
        { username: req.query.username.slice(0, 50).toLowerCase() },
        { target: req.query.username.slice(0, 50).toLowerCase() },
      ];
    const [items, total] = await Promise.all([
      AdminAudit.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
      AdminAudit.countDocuments(filter),
    ]);
    res.json({
      items: items.map((event) => ({
        id: event._id,
        event: event.event,
        username: event.username,
        target: event.target,
        ip: event.ip,
        device: describeAgent(event.userAgent),
        createdAt: event.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / 30),
    });
  }));
  router.get("/security/sessions", wrap(async (req, res) => {
    const sessions = await AdminSession.find(activeSession())
      .populate("userId", "name username role")
      .sort({ lastSeenAt: -1 })
      .lean();
    res.json({
      items: sessions.map((session) => ({
        id: session._id,
        user: session.userId,
        device: describeAgent(session.userAgent),
        ip: session.ip,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        current: session._id.equals(req.adminSession._id),
      })),
    });
  }));
  router.delete("/security/sessions/:id", wrap(async (req, res) => {
    if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
    if (req.adminSession._id.equals(req.params.id))
      throw httpError(409, "Pour fermer cette session, utilisez « Se déconnecter ».");
    const session = await AdminSession.findByIdAndDelete(req.params.id).populate("userId", "username");
    if (!session) throw httpError(404, "Session introuvable ou déjà fermée.");
    await audit("session_revoked", req, { user: req.admin, target: session.userId?.username || "" });
    res.json({ message: "Session fermée." });
  }));
  router.get("/security/api", wrap(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const filter = {};
    if (typeof req.query.username === "string" && req.query.username)
      filter.username = req.query.username.slice(0, 50).toLowerCase();
    if (["GET", "POST", "PATCH", "PUT", "DELETE"].includes(req.query.method)) filter.method = req.query.method;
    if (req.query.status === "errors") filter.status = { $gte: 400 };
    if (req.query.status === "denied") filter.status = { $in: [401, 403] };
    if (req.query.status === "server") filter.status = { $gte: 500 };
    if (typeof req.query.q === "string" && req.query.q)
      filter.path = { $regex: escapeRegex(req.query.q.slice(0, 100)), $options: "i" };
    const [items, total] = await Promise.all([
      ApiLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 40).limit(40).lean(),
      ApiLog.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / 40) });
  }));

  // Rapports généraux : students, personnel, finances, contenu et visiteurs.
  router.get("/reports", wrap(async (req, res) => {
    const period = range(req);
    const created = { createdAt: utcRange(period) };
    const days = { $gte: period.from, $lte: period.to };
    const contentCounts = await Promise.all(
      Object.entries(resourceModels).map(async ([key, model]) => [
        key,
        { total: await model.countDocuments(), published: await model.countDocuments({ published: true }) },
      ]),
    );
    const [
      registrations,
      registrationsInRange,
      byStatus,
      byCourse,
      contacts,
      contactsInRange,
      attempts,
      staff,
      payments,
      billed,
      expenses,
      salaries,
      visits,
      pages,
      courses,
    ] = await Promise.all([
      Registration.countDocuments(),
      Registration.countDocuments(created),
      Registration.aggregate([{ $match: created }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Registration.aggregate([
        { $match: created },
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Contact.countDocuments(),
      Contact.countDocuments(created),
      AssessmentAttempt.countDocuments(created),
      Staff.aggregate([{ $group: { _id: { kind: "$kind", status: "$status" }, count: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { status: "confirmed", date: days } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      StudentAccount.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" }, paid: { $sum: "$paidAmount" } } },
      ]),
      Expense.aggregate([
        { $match: { status: "validated", date: days } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      StaffPayment.aggregate([
        { $match: { status: "paid", date: days } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      SiteVisit.aggregate([
        { $match: { day: days } },
        { $group: { _id: "$day", views: { $sum: "$views" }, sessions: { $sum: "$sessions" } } },
        { $sort: { _id: 1 } },
      ]),
      SiteVisit.aggregate([
        { $match: { day: days } },
        { $group: { _id: "$path", views: { $sum: "$views" } } },
        { $sort: { views: -1 } },
        { $limit: 10 },
      ]),
      Course.find().select("id title").lean(),
    ]);
    const title = (id) => courses.find((course) => course.id === id)?.title || id || "Non précisé";
    const staffCount = (kind, status) =>
      staff.filter((row) => row._id.kind === kind && (!status || row._id.status === status)).reduce((sum, row) => sum + row.count, 0);
    res.json({
      period,
      students: {
        registrations,
        registrationsInRange,
        byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
        byCourse: byCourse.map((row) => ({ id: row._id, title: title(row._id), count: row.count })),
        contacts,
        contactsInRange,
        attempts,
      },
      staff: {
        teachers: staffCount("teacher", "active"),
        employees: staffCount("employee", "active"),
        total: staffCount("teacher") + staffCount("employee"),
      },
      finance: {
        payments: payments[0]?.count || 0,
        collected: payments[0]?.total || 0,
        billed: billed[0]?.total || 0,
        receivable: Math.max(0, (billed[0]?.total || 0) - (billed[0]?.paid || 0)),
        expenses: expenses[0]?.total || 0,
        expenseCount: expenses[0]?.count || 0,
        salaries: salaries[0]?.total || 0,
      },
      content: Object.fromEntries(contentCounts),
      visitors: {
        views: visits.reduce((sum, row) => sum + row.views, 0),
        sessions: visits.reduce((sum, row) => sum + row.sessions, 0),
        daily: visits.map((row) => ({ day: row._id, views: row.views, sessions: row.sessions })),
        pages: pages.map((row) => ({ path: row._id, views: row.views })),
      },
    });
  }));

  // Exports CSV des listes (préparés côté navigateur).
  const exportsList = {
    registrations: async (period) =>
      (await Registration.find({ createdAt: utcRange(period) }).sort({ createdAt: -1 }).lean()).map((item) => ({
        Référence: item.reference,
        Nom: item.name,
        Téléphone: item.phone,
        "E-mail": item.email,
        Formation: item.courseId,
        Disponibilité: item.schedule,
        Statut: item.status,
        Date: today(item.createdAt),
      })),
    contacts: async (period) =>
      (await Contact.find({ createdAt: utcRange(period) }).sort({ createdAt: -1 }).lean()).map((item) => ({
        Référence: item.reference,
        Nom: item.name,
        Téléphone: item.phone,
        "E-mail": item.email,
        Type: item.kind,
        Message: item.message,
        Statut: item.status,
        Date: today(item.createdAt),
      })),
    staff: async () =>
      (await Staff.find().sort({ kind: 1, fullName: 1 }).lean()).map((item) => ({
        Matricule: item.reference,
        Type: item.kind === "teacher" ? "Enseignant" : "Employé",
        Nom: item.fullName,
        Poste: item.position,
        Spécialité: item.specialty,
        Téléphone: item.phone,
        "E-mail": item.email,
        Statut: item.status,
        "Date d’embauche": item.hireDate || "",
      })),
    payments: async (period) =>
      (await Payment.find({ date: { $gte: period.from, $lte: period.to } }).sort({ date: -1 }).lean()).map((item) => ({
        Reçu: item.receiptNumber,
        Date: item.date,
        Student: item.studentName,
        Formation: item.courseId,
        Montant: item.amount,
        Moyens: item.splits.map((split) => `${split.method}:${split.amount}`).join(" + "),
        Statut: item.status,
        "Saisi par": item.recordedBy?.name || "",
      })),
    expenses: async (period) =>
      (await Expense.find({ date: { $gte: period.from, $lte: period.to } }).sort({ date: -1 }).lean()).map((item) => ({
        Référence: item.reference,
        Date: item.date,
        Catégorie: item.categoryName,
        Bénéficiaire: item.beneficiary,
        Montant: item.amount,
        Moyen: item.method,
        Statut: item.status,
      })),
    visits: async (period) =>
      (await SiteVisit.find({ day: { $gte: period.from, $lte: period.to } }).sort({ day: 1, path: 1 }).lean()).map((item) => ({
        Jour: item.day,
        Page: item.path,
        Vues: item.views,
        Visites: item.sessions,
      })),
  };
  router.get("/export/:dataset", wrap(async (req, res) => {
    if (!Object.hasOwn(exportsList, req.params.dataset)) throw httpError(404, "Export introuvable.");
    res.json({ rows: await exportsList[req.params.dataset](range(req)) });
  }));
  return router;
}

// Listes de choix partagées par les formulaires des trois modules.
export function createLookupRouter() {
  const router = Router();
  const needs = (test) => (req, res, next) =>
    test(req.admin)
      ? next()
      : res.status(403).json({ error: "Accès non autorisé.", forbidden: true });
  const hrOrFinance = (user) => canModule(user, "rh") || canModule(user, "finance");
  router.get("/courses", wrap(async (_req, res) => {
    res.json({ items: await Course.find().select("id title department published").sort({ title: 1 }).lean() });
  }));
  router.get("/staff", needs(hrOrFinance), wrap(async (req, res) => {
    const filter = {};
    if (["teacher", "employee"].includes(req.query.kind)) filter.kind = req.query.kind;
    if (req.query.active === "1") filter.status = "active";
    res.json({
      items: await Staff.find(filter).select("fullName reference kind status position specialty").sort({ fullName: 1 }).lean(),
    });
  }));
  router.get("/accounts", needs(hrOrFinance), wrap(async (_req, res) => {
    res.json({ items: await FinanceAccount.find().select("name kind number active").sort({ kind: 1, name: 1 }).lean() });
  }));
  router.get(
    "/registrations",
    needs(
      (user) =>
        can(user, "finance.schedules", "view") ||
        can(user, "finance.payments", "create") ||
        can(user, "finance.students", "view") ||
        can(user, "centre.registrations", "view"),
    ),
    wrap(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
      const filter = q
        ? { $or: ["name", "phone", "email", "reference"].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } })) }
        : {};
      // Encaissement : tous les students de la formation choisie (hors dossiers clôturés).
      const byCourse = typeof req.query.courseId === "string" && req.query.courseId;
      if (byCourse) Object.assign(filter, { courseId: req.query.courseId.slice(0, 80), status: { $ne: "closed" } });
      // student=1 : students de la liste ; student=0 : inscrits pas encore ajoutés comme students.
      if (req.query.student === "1") filter.isStudent = true;
      if (req.query.student === "0") filter.isStudent = { $ne: true };
      const full = byCourse || req.query.student === "0";
      res.json({
        items: await Registration.find(filter)
          .select("reference name phone email courseId status createdAt username profile photoUrl enrolledOn")
          .sort(byCourse ? { name: 1 } : { createdAt: -1 })
          .limit(full ? 500 : 20)
          .lean(),
      });
    }),
  );
  const finance = needs((user) => canModule(user, "finance"));
  router.get("/fees", finance, wrap(async (_req, res) => {
    res.json({ items: await FeeRate.find({ active: true }).sort({ label: 1 }).lean() });
  }));
  router.get("/discounts", finance, wrap(async (_req, res) => {
    res.json({ items: await Discount.find({ active: true }).sort({ name: 1 }).lean() });
  }));
  // Dossiers à encaisser : recherche par nom, téléphone ou référence.
  router.get("/student-accounts", finance, wrap(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
    const filter = { status: "active" };
    if (q)
      filter.$or = ["studentName", "phone", "reference", "payer.name"].map((field) => ({
        [field]: { $regex: escapeRegex(q), $options: "i" },
      }));
    const items = await StudentAccount.find(filter)
      .select("reference studentName phone courseTitle totalAmount paidAmount payer installments status")
      .sort({ updatedAt: -1 })
      .limit(15)
      .lean();
    res.json({ items: items.map((item) => ({ ...item, balance: item.totalAmount - item.paidAmount })) });
  }));
  router.get("/expense-categories", finance, wrap(async (_req, res) => {
    res.json({ items: await ExpenseCategory.find({ active: true }).sort({ name: 1 }).lean() });
  }));
  // En-tête des documents imprimés (factures, reçus, bulletins).
  router.get("/issuer", wrap(async (_req, res) => {
    const { centreName, centreAddress, centrePhone, centreEmail, taxId, currency, invoiceFooter } = await getSettings("finance");
    res.json({ centreName, centreAddress, centrePhone, centreEmail, taxId, currency, invoiceFooter });
  }));
  return router;
}
