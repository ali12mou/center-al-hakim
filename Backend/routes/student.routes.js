import { randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  StudentUser,
  StudentSession,
  Lesson,
  StudentAttendance,
  Grade,
  Announcement,
} from "../models/student.models.js";
import { StudentAccount, Payment, Invoice } from "../models/finance.models.js";
import { Course } from "../models/index.js";
import {
  hashPassword,
  verifyPassword,
  hashToken,
} from "../services/password.service.js";
import {
  safeEqual,
  clientIp,
  clientAgent,
  loginLockedUntil,
  registerLoginFailure,
  clearLoginFailures,
} from "../services/security.service.js";
import { summarize } from "../services/finance.service.js";
import { getSettings } from "../services/settings.service.js";
import { passwordProblem } from "../validators/password-policy.js";
import { PRIVATE_DIR } from "../controllers/upload.controller.js";
import { httpError, sendError, validId } from "../services/crud.js";

// Application des students : connexion et lecture de LEURS données uniquement.
// Le cookie « ah_student » n’est envoyé qu’aux adresses /api/student : il
// n’atteint jamais l’administration, qui ne lit que « ah_admin ».
export const STUDENT_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export const STUDENT_SESSION_IDLE = 14 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 5;
const COOKIE = "ah_student";
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/api/student",
};
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const PASSWORD_ROUTES = ["/auth/password", "/auth/logout"];
// Le verrouillage par identifiant ne se mélange pas avec celui des administrateurs.
const throttleName = (username) => `student:${username}`;

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

const publicStudent = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  phone: user.phone || "",
  email: user.email || "",
  mustChangePassword: Boolean(user.mustChangePassword),
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
  const session = await StudentSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;
  const lastSeen = session.lastSeenAt || session.createdAt;
  if (Date.now() - lastSeen.getTime() > STUDENT_SESSION_IDLE) {
    await StudentSession.deleteOne({ _id: session._id });
    return null;
  }
  if (Date.now() - lastSeen.getTime() > 5 * 60_000) {
    session.lastSeenAt = new Date();
    await session.save();
  }
  return session;
}

async function startSession(user, req, res) {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  await StudentSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(Date.now() + STUDENT_SESSION_MAX_AGE),
    lastSeenAt: new Date(),
    ip: clientIp(req),
    userAgent: clientAgent(req),
  });
  const stale = await StudentSession.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS)
    .select("_id")
    .lean();
  if (stale.length)
    await StudentSession.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: STUDENT_SESSION_MAX_AGE });
  return { user: publicStudent(user), csrfToken };
}

async function requireStudent(req, res, next) {
  try {
    const session = await findSession(req);
    if (!session)
      return res.status(401).json({
        error: "Connectez-vous à votre espace student.",
        sessionExpired: true,
      });
    const user = await StudentUser.findById(session.userId);
    if (!user || user.active === false) {
      await StudentSession.deleteMany({ userId: session.userId });
      return res.status(401).json({
        error: "Votre accès a été désactivé. Contactez le centre.",
        sessionExpired: true,
      });
    }
    if (
      !SAFE_METHODS.includes(req.method) &&
      !safeEqual(req.get("X-CSRF-Token"), session.csrfToken)
    )
      return res
        .status(403)
        .json({ error: "La vérification de sécurité a échoué. Rouvrez l’application." });
    if (user.mustChangePassword && !PASSWORD_ROUTES.includes(req.path))
      return res.status(403).json({
        error: "Choisissez votre mot de passe personnel pour continuer.",
        passwordChangeRequired: true,
      });
    req.student = user;
    req.studentSession = session;
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

// Dossiers du student connecté (jamais ceux d’un autre), sauf les dossiers annulés.
async function myAccounts(student) {
  return StudentAccount.find({
    _id: { $in: student.accountIds },
    status: { $ne: "cancelled" },
  })
    .sort({ startDate: -1 })
    .lean();
}
const courseIdsOf = (accounts) => [
  ...new Set(accounts.map((account) => account.courseId).filter(Boolean)),
];

export function createStudentRouter(isDatabaseReady) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!isDatabaseReady())
      return res.status(503).json({
        error: "Le service est momentanément indisponible. Réessayez dans un instant.",
      });
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
      const user = session && (await StudentUser.findById(session.userId));
      const valid = user && user.active !== false;
      res.json({
        user: valid ? publicStudent(user) : null,
        csrfToken: valid ? session.csrfToken : null,
      });
    }),
  );

  router.post(
    "/auth/login",
    loginLimit,
    wrap(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success)
        throw httpError(400, "Renseignez votre identifiant et votre mot de passe.");
      const username = parsed.data.username.toLowerCase();
      const lockedUntil = await loginLockedUntil(throttleName(username));
      if (lockedUntil) {
        const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60_000));
        throw httpError(429, `Trop de tentatives. Réessayez dans ${minutes} min.`);
      }
      const user = await StudentUser.findOne({ username }).select("+passwordHash");
      const valid = await verifyPassword(
        parsed.data.password,
        user?.passwordHash || (await timingHash()),
      );
      if (!user || !valid) {
        const locked = await registerLoginFailure(throttleName(username));
        throw httpError(
          locked ? 429 : 401,
          locked
            ? "Trop de tentatives. Pour votre sécurité, la connexion est bloquée 15 minutes."
            : "Identifiant ou mot de passe incorrect.",
        );
      }
      await clearLoginFailures(throttleName(username));
      if (user.active === false)
        throw httpError(403, "Votre accès est désactivé. Contactez le centre.");
      user.lastLoginAt = new Date();
      await user.save();
      res.json(await startSession(user, req, res));
    }),
  );

  router.use(requireStudent);

  router.post(
    "/auth/logout",
    wrap(async (req, res) => {
      await StudentSession.deleteOne({ _id: req.studentSession._id });
      res.clearCookie(COOKIE, cookieOptions);
      res.json({ message: "Vous êtes déconnecté." });
    }),
  );

  router.post(
    "/auth/password",
    loginLimit,
    wrap(async (req, res) => {
      const parsed = passwordSchema.safeParse(req.body);
      if (!parsed.success)
        throw httpError(400, "Renseignez votre mot de passe actuel et le nouveau.");
      const { currentPassword, newPassword } = parsed.data;
      const user = await StudentUser.findById(req.student._id).select("+passwordHash");
      if (!(await verifyPassword(currentPassword, user.passwordHash)))
        throw httpError(400, "Le mot de passe actuel est incorrect.");
      const problem = passwordProblem(newPassword, user);
      if (problem) throw httpError(400, problem);
      if (await verifyPassword(newPassword, user.passwordHash))
        throw httpError(400, "Choisissez un mot de passe différent de l’actuel.");
      user.passwordHash = await hashPassword(newPassword);
      user.mustChangePassword = false;
      user.passwordChangedAt = new Date();
      await user.save();
      await StudentSession.deleteMany({ userId: user._id });
      res.json(await startSession(user, req, res));
    }),
  );

  // Profil, formations suivies et situation financière.
  router.get(
    "/me",
    wrap(async (req, res) => {
      const accounts = await myAccounts(req.student);
      const ids = accounts.map((account) => account._id);
      const [payments, invoices, courses, { currency }] = await Promise.all([
        Payment.find({ studentAccountId: { $in: ids }, status: { $ne: "cancelled" } })
          .select("receiptNumber studentAccountId date amount status splits.method")
          .sort({ date: -1 })
          .lean(),
        Invoice.find({ studentAccountId: { $in: ids }, status: "issued" })
          .select("number studentAccountId issueDate dueDate total")
          .sort({ issueDate: -1 })
          .lean(),
        Course.find({ id: { $in: courseIdsOf(accounts) } })
          .select("id title level duration format department imageUrl image")
          .lean(),
        getSettings("finance"),
      ]);
      res.json({
        user: publicStudent(req.student),
        currency: currency || "FDJ",
        accounts: accounts.map((account) => {
          const summary = summarize(account);
          return {
            id: account._id,
            reference: account.reference,
            courseId: account.courseId,
            courseTitle: account.courseTitle,
            course: courses.find((course) => course.id === account.courseId) || null,
            startDate: account.startDate,
            status: account.status,
            totalAmount: account.totalAmount,
            paidAmount: account.paidAmount,
            discountAmount: account.discountAmount,
            balance: summary.balance,
            overdueAmount: summary.overdueAmount,
            nextDue: summary.nextDue,
            paymentStatus: summary.paymentStatus,
            schedule: summary.schedule.map(({ label, dueDate, amount, paid, remaining, status }) => ({
              label,
              dueDate,
              amount,
              paid,
              remaining,
              status,
            })),
          };
        }),
        payments: payments.map((payment) => ({
          id: payment._id,
          accountId: payment.studentAccountId,
          receiptNumber: payment.receiptNumber,
          date: payment.date,
          amount: payment.amount,
          status: payment.status,
          methods: [...new Set((payment.splits || []).map((split) => split.method))],
        })),
        invoices: invoices.map((invoice) => ({
          id: invoice._id,
          accountId: invoice.studentAccountId,
          number: invoice.number,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          total: invoice.total,
        })),
      });
    }),
  );

  router.get(
    "/lessons",
    wrap(async (req, res) => {
      const courseIds = courseIdsOf(await myAccounts(req.student));
      const lessons = await Lesson.find({ courseId: { $in: courseIds }, published: true })
        .select("courseId title kind description body fileUrl link date order createdAt")
        .sort({ courseId: 1, order: 1, date: -1, createdAt: -1 })
        .lean();
      res.json({
        items: lessons.map(({ fileUrl, ...lesson }) => ({
          ...lesson,
          hasFile: Boolean(fileUrl),
          fileType: fileUrl?.endsWith(".pdf") ? "pdf" : fileUrl ? "image" : "",
        })),
      });
    }),
  );

  // Document d’un cours : seulement s’il appartient à une formation du student.
  router.get(
    "/lessons/:id/file",
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(404, "Document introuvable.");
      const courseIds = courseIdsOf(await myAccounts(req.student));
      const lesson = await Lesson.findOne({
        _id: req.params.id,
        courseId: { $in: courseIds },
        published: true,
      }).lean();
      const name = lesson?.fileUrl?.match(/^\/api\/admin\/files\/([0-9a-f-]{36}\.(pdf|png|jpg|gif|webp))$/)?.[1];
      if (!name) throw httpError(404, "Document introuvable.");
      const pdf = name.endsWith(".pdf");
      const safeTitle = lesson.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 60) || "document";
      res.set({
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": pdf ? `attachment; filename="${safeTitle}.pdf"` : "inline",
      });
      res.sendFile(name, { root: PRIVATE_DIR, dotfiles: "deny" }, (error) => {
        if (error && !res.headersSent) res.status(404).json({ error: "Document introuvable." });
      });
    }),
  );

  router.get(
    "/progress",
    wrap(async (req, res) => {
      const ids = req.student.accountIds;
      const [attendance, grades] = await Promise.all([
        StudentAttendance.find({ studentAccountId: { $in: ids } })
          .select("studentAccountId courseId date status notes")
          .sort({ date: -1 })
          .limit(500)
          .lean(),
        Grade.find({ studentAccountId: { $in: ids }, published: true })
          .select("studentAccountId courseId title date score maxScore comment")
          .sort({ date: -1 })
          .limit(500)
          .lean(),
      ]);
      const count = (status) => attendance.filter((row) => row.status === status).length;
      const attended = count("present") + count("late");
      const average = grades.length
        ? Math.round(
            (grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 20, 0) /
              grades.length) *
              10,
          ) / 10
        : null;
      res.json({
        attendance,
        grades,
        stats: {
          sessions: attendance.length,
          present: count("present"),
          late: count("late"),
          absent: count("absent"),
          excused: count("excused"),
          rate: attendance.length ? Math.round((attended / attendance.length) * 100) : null,
          average,
        },
      });
    }),
  );

  router.get(
    "/announcements",
    wrap(async (req, res) => {
      const courseIds = courseIdsOf(await myAccounts(req.student));
      const items = await Announcement.find({
        published: true,
        courseId: { $in: ["", ...courseIds] },
      })
        .select("title body courseId date pinned")
        .sort({ pinned: -1, date: -1, createdAt: -1 })
        .limit(50)
        .lean();
      res.json({ items });
    }),
  );

  router.use((_req, res) => res.status(404).json({ error: "Route introuvable." }));
  return router;
}
