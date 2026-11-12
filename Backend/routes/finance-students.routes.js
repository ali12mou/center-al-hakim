// Finances › Liste des students et Encaissements : les inscrits du centre
// (collection Registration) avec leur situation de paiement, et un formulaire
// d’encaissement simple qui ouvre au besoin le dossier financier du student.
import mongoose from "mongoose";
import {
  FeeRate,
  FinanceAccount,
  Payment,
  StudentAccount,
} from "../models/finance.models.js";
import { Registration } from "../models/platform.models.js";
import { Course } from "../models/index.js";
import { nextNumber } from "../models/system.models.js";
import { permit } from "../middleware/admin.middleware.js";
import { escapeRegex, httpError, parseBody, sendError, validId } from "../services/crud.js";
import { hashPassword } from "../services/password.service.js";
import { buildInstallments, refreshStudentAccount } from "../services/finance.service.js";
import { today } from "../services/dates.js";
import { collectionSchema, labels, studentSchema } from "../validators/finance.validator.js";
import { preparePayment } from "./finance.routes.js";

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
const money = (value) => new Intl.NumberFormat("fr-FR").format(value);
const pageOf = (req) => {
  // Export CSV : toutes les lignes du filtre en une fois.
  if (req.query.all === "1") return { page: 1, limit: 5000, skip: 0 };
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
};
const searchText = (req) =>
  typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
const courseTitles = async () =>
  Object.fromEntries((await Course.find().select("id title").lean()).map((course) => [course.id, course.title]));
// Montant dû d’un frais : un frais mensuel est multiplié par la durée.
export const feeTotal = (fee) =>
  (fee.feeType === "monthly" ? fee.amount * (fee.durationMonths || 1) : fee.amount) +
  (fee.registrationFee || 0);

// Situation de paiement par student, d’après ses dossiers financiers.
export async function paymentStatusByStudent(ids) {
  const match = { status: { $ne: "cancelled" }, registrationId: { $ne: null } };
  if (ids) match.registrationId = { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) };
  const rows = await StudentAccount.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$registrationId",
        due: { $sum: "$totalAmount" },
        paid: { $sum: "$paidAmount" },
      },
    },
  ]);
  return Object.fromEntries(
    rows.map((row) => [
      String(row._id),
      {
        due: row.due,
        paid: row.paid,
        balance: Math.max(0, row.due - row.paid),
        paymentStatus: row.paid <= 0 ? "unpaid" : row.paid >= row.due ? "paid" : "partial",
      },
    ]),
  );
}
const noPayment = { due: 0, paid: 0, balance: 0, paymentStatus: "unpaid" };

// Students comptés au tableau de bord : ceux de la liste des students ou ayant un dossier.
export async function studentPaymentCounts() {
  const [students, statuses] = await Promise.all([
    Registration.find({ isStudent: true }).select("_id").lean(),
    paymentStatusByStudent(),
  ]);
  const ids = new Set([...students.map((item) => String(item._id)), ...Object.keys(statuses)]);
  let paid = 0;
  let upToDate = 0;
  for (const id of ids) {
    const status = statuses[id]?.paymentStatus || "unpaid";
    if (status !== "unpaid") paid += 1;
    if (status === "paid") upToDate += 1;
  }
  return { total: ids.size, paid, unpaid: ids.size - paid, upToDate };
}

async function assertUniqueUsername(username, exceptId) {
  if (!username) return;
  const clash = await Registration.findOne({ username, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select("_id")
    .lean();
  if (clash) throw httpError(409, `Le nom d’utilisateur « ${username} » est déjà utilisé.`);
}
const publicStudent = (item, titles, statuses) => {
  const { passwordHash, ...rest } = item;
  return {
    ...rest,
    courseTitle: titles[item.courseId] || item.courseId || "Non précisé",
    enrolledOn: item.enrolledOn || new Date(item.createdAt).toISOString().slice(0, 10),
    ...(statuses[String(item._id)] || noPayment),
  };
};

export function addStudentFinanceRoutes(router) {
  // ——— Liste des students ———
  router.get(
    "/students",
    permit("finance.students", "view"),
    wrap(async (req, res) => {
      const { page, limit, skip } = pageOf(req);
      // Seuls les inscrits ajoutés comme students (pas toutes les demandes du site).
      const filter = { isStudent: true };
      const q = searchText(req);
      if (q)
        filter.$or = ["name", "phone", "email", "reference", "username"].map((field) => ({
          [field]: { $regex: escapeRegex(q), $options: "i" },
        }));
      if (typeof req.query.courseId === "string" && req.query.courseId)
        filter.courseId = req.query.courseId.slice(0, 80);
      if (["new", "contacted", "confirmed", "closed"].includes(req.query.status))
        filter.status = req.query.status;
      // Filtre « payé / non payé » : calculé sur les dossiers financiers.
      const paymentFilter = ["paid", "partial", "unpaid"].includes(req.query.payment) ? req.query.payment : "";
      if (paymentFilter) {
        const statuses = await paymentStatusByStudent();
        const ids = Object.entries(statuses)
          .filter(([, value]) => value.paymentStatus === paymentFilter)
          .map(([id]) => new mongoose.Types.ObjectId(id));
        filter._id = paymentFilter === "unpaid"
          ? { $nin: Object.entries(statuses).filter(([, value]) => value.paymentStatus !== "unpaid").map(([id]) => new mongoose.Types.ObjectId(id)) }
          : { $in: ids };
      }
      const [items, total, titles] = await Promise.all([
        Registration.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Registration.countDocuments(filter),
        courseTitles(),
      ]);
      const statuses = await paymentStatusByStudent(items.map((item) => item._id));
      res.json({
        items: items.map((item) => publicStudent(item, titles, statuses)),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    }),
  );
  async function saveStudent(req, res, record) {
    const { registrationId, ...data } = parseBody(record ? studentSchema.partial() : studentSchema, req.body, labels);
    if (data.courseId && !(await Course.exists({ id: data.courseId })))
      throw httpError(400, "Formation introuvable.");
    // « Nouveau student » choisi dans les Inscrits : on complète sa fiche, sans doublon.
    let fromInscrits = null;
    if (!record && registrationId) {
      fromInscrits = await Registration.findById(registrationId);
      if (!fromInscrits) throw httpError(404, "Inscrit introuvable.");
      if (fromInscrits.isStudent)
        throw httpError(409, `${fromInscrits.name} est déjà dans la liste des students.`);
      record = fromInscrits;
    }
    if ("username" in data) {
      data.username = data.username.toLowerCase();
      await assertUniqueUsername(data.username, record?._id);
    }
    const { password, ...fields } = data;
    if (password) {
      fields.passwordHash = await hashPassword(password);
      fields.hasPassword = true;
    }
    let item;
    if (record) {
      record.set(fields);
      if (fromInscrits) {
        record.isStudent = true;
        record.enrolledOn ||= fields.enrolledOn || record.createdAt.toISOString().slice(0, 10);
      }
      item = await record.save();
    } else {
      item = await Registration.create({
        ...fields,
        isStudent: true,
        enrolledOn: fields.enrolledOn || today(),
        reference: await nextNumber("ELV"),
        consent: true,
      });
    }
    const created = !record || fromInscrits;
    const [titles, statuses] = await Promise.all([courseTitles(), paymentStatusByStudent([item._id])]);
    res.status(created ? 201 : 200).json({ item: publicStudent(item.toObject(), titles, statuses) });
  }
  router.post("/students", permit("finance.students", "create"), wrap((req, res) => saveStudent(req, res)));
  router.patch(
    "/students/:id",
    permit("finance.students", "update"),
    wrap(async (req, res) => {
      const record = validId(req.params.id) && (await Registration.findOne({ _id: req.params.id, isStudent: true }));
      if (!record) throw httpError(404, "Student introuvable.");
      await saveStudent(req, res, record);
    }),
  );
  router.delete(
    "/students/:id",
    permit("finance.students", "delete"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      if (await StudentAccount.exists({ registrationId: req.params.id }))
        throw httpError(409, "Ce student a un dossier financier : passez son statut à « Clôturé » plutôt que de le retirer.");
      // Retiré de la liste des students seulement : la fiche reste dans les Inscrits.
      const result = await Registration.updateOne({ _id: req.params.id, isStudent: true }, { $set: { isStudent: false } });
      if (!result.matchedCount) throw httpError(404, "Student introuvable.");
      res.json({ message: "Student retiré de la liste (il reste dans Gestion du centre › Inscrits)." });
    }),
  );

  // ——— Encaissements ———
  router.get(
    "/collections",
    permit("finance.payments", "view"),
    wrap(async (req, res) => {
      const { page, limit, skip } = pageOf(req);
      const filter = {};
      const q = searchText(req);
      if (q)
        filter.$or = ["studentName", "reference", "receiptNumber"].map((field) => ({
          [field]: { $regex: escapeRegex(q), $options: "i" },
        }));
      if (typeof req.query.courseId === "string" && req.query.courseId) filter.courseId = req.query.courseId.slice(0, 80);
      if (["confirmed", "cancelled"].includes(req.query.status)) filter.status = req.query.status;
      if (typeof req.query.method === "string" && req.query.method) filter["splits.method"] = req.query.method;
      const [items, total, titles] = await Promise.all([
        Payment.find(filter)
          .sort({ date: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate({
            path: "studentAccountId",
            select: "reference registrationId feeId courseTitle",
            populate: [
              { path: "registrationId", select: "reference name phone photoUrl" },
              { path: "feeId", select: "label feeType" },
            ],
          })
          .lean(),
        Payment.countDocuments(filter),
        courseTitles(),
      ]);
      res.json({
        items: items.map((item) => {
          const account = item.studentAccountId || {};
          return {
            ...item,
            studentAccountId: account._id,
            studentCode: account.registrationId?.reference || account.reference || "",
            photoUrl: account.registrationId?.photoUrl || "",
            courseTitle: titles[item.courseId] || account.courseTitle || item.courseId || "",
            feeLabel: account.feeId?.label || "",
            method: item.splits?.[0]?.method || "",
          };
        }),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    }),
  );
  router.post(
    "/collections",
    permit("finance.payments", "create"),
    wrap(async (req, res) => {
      const data = parseBody(collectionSchema, req.body, labels);
      const student = await Registration.findById(data.registrationId);
      if (!student) throw httpError(400, "Student introuvable.");
      const fee = data.feeId
        ? await FeeRate.findOne({ _id: data.feeId, courseId: data.courseId }).lean()
        : await FeeRate.findOne({ courseId: data.courseId, active: true }).sort({ createdAt: -1 }).lean();
      if (!fee)
        throw httpError(
          400,
          data.feeId
            ? "Ce frais n’appartient pas à la formation choisie."
            : "Aucun frais n’est défini pour cette formation : ajoutez-le dans « Frais des formations ».",
        );
      const target = await FinanceAccount.findOne({ kind: data.method, active: true }).sort({ name: 1 }).lean();
      if (!target)
        throw httpError(409, "Aucun compte actif pour ce mode de paiement : créez-le dans « Caisse et comptes ».");

      // Un dossier par student et par frais, ouvert au premier encaissement.
      let account = await StudentAccount.findOne({
        registrationId: student._id,
        feeId: fee._id,
        status: { $ne: "cancelled" },
      });
      const courseTitle = (await Course.findOne({ id: data.courseId }).select("title").lean())?.title || data.courseId;
      if (!account) {
        const base = fee.feeType === "monthly" ? fee.amount * (fee.durationMonths || 1) : fee.amount;
        const total = base + (fee.registrationFee || 0);
        const plan = fee.feeType === "monthly" && fee.durationMonths > 1 ? "monthly" : "full";
        const startDate = data.date || today();
        account = await StudentAccount.create({
          reference: await nextNumber("DOS"),
          registrationId: student._id,
          studentName: student.name,
          phone: student.phone,
          email: student.email || "",
          courseId: data.courseId,
          courseTitle,
          feeId: fee._id,
          baseAmount: base,
          registrationFee: fee.registrationFee || 0,
          totalAmount: total,
          plan,
          installments: buildInstallments({ plan, total, count: fee.durationMonths || 1, startDate }),
          startDate,
          status: "active",
          history: [{ by: req.admin.name, action: "Dossier créé", detail: `${fee.label} — ${money(total)} (premier encaissement)` }],
        });
      }
      const balance = account.totalAmount - account.paidAmount;
      if (balance <= 0)
        throw httpError(409, `« ${fee.label} » est déjà entièrement payé par ${student.name}.`);
      const prepared = await preparePayment(
        {
          studentAccountId: account._id,
          date: data.date || today(),
          splits: [{ accountId: target._id, amount: data.amount, method: data.method }],
          proofUrl: "",
          notes: data.notes,
        },
        req,
      );
      const item = await Payment.create(prepared);
      await refreshStudentAccount(account._id);
      // Le premier paiement confirme l’inscription et place l’inscrit parmi les students.
      if (["new", "contacted"].includes(student.status) || !student.isStudent) {
        if (["new", "contacted"].includes(student.status)) student.status = "confirmed";
        student.isStudent = true;
        await student.save();
      }
      res.status(201).json({ item, message: `Encaissement ${item.receiptNumber} enregistré.` });
    }),
  );
}
