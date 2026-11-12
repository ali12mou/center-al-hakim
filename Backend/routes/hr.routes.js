import { Router } from "express";
import { z } from "zod";
import {
  Staff,
  Contract,
  Assignment,
  PlanningEntry,
  Attendance,
  Leave,
  PayAdjustment,
  Payslip,
} from "../models/hr.models.js";
import { StaffPayment } from "../models/finance.models.js";
import { nextNumber } from "../models/system.models.js";
import { permit } from "../middleware/admin.middleware.js";
import { can } from "../config/permissions.js";
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
import {
  attendanceFromPlanning,
  calculatePayroll,
  generatePlanning,
  leaveDates,
} from "../services/hr.service.js";
import { getSettings, saveSettings } from "../services/settings.service.js";
import { currentMonth, addDays, hoursBetween, today } from "../services/dates.js";
import {
  staffSchema,
  ratesSchema,
  payFields,
  documentSchema,
  contractSchema,
  assignmentSchema,
  planningSchema,
  attendanceSchema,
  leaveSchema,
  adjustmentSchema,
  labels,
} from "../validators/hr.validator.js";

const staffSection = (kind) =>
  kind === "teacher" ? "rh.teachers" : kind === "employee" ? "rh.employees" : null;
const person = ["staffId", "fullName reference kind position"];
const byStaff = { staffId: (value) => (validId(value) ? { staffId: value } : {}) };
const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(error, res, next);
  }
};
async function ensureStaff(id) {
  if (!(await Staff.exists({ _id: id })))
    throw httpError(400, "La personne choisie n’existe pas.");
}

export function createHrRouter() {
  const router = Router();

  // Personnel : enseignants et employés partagent le même dossier.
  crudRoutes(router, {
    path: "/staff",
    model: Staff,
    schema: staffSchema,
    labels,
    section: (req, record) => staffSection(record?.kind || req.query.kind),
    search: ["fullName", "reference", "phone", "email", "position", "specialty"],
    filters: {
      kind: (value) => ({ kind: value }),
      status: (value) => ({ status: value }),
    },
    sort: { status: 1, fullName: 1 },
    readOnly: ["kind", "reference", "documents"],
    async prepare(data, { req, record }) {
      // Les montants de rémunération relèvent des « Tarifs et salaires ».
      if (!can(req.admin, "rh.rates", "update"))
        for (const key of payFields) delete data[key];
      if (!record) {
        if (!can(req.admin, "rh.rates", "update") && data.kind === "teacher")
          data.hourlyRate = (await getSettings("hr")).defaultHourlyRate;
        if (data.kind === "teacher" && !data.payType) data.payType = "hourly";
        data.reference = await nextNumber(data.kind === "teacher" ? "ENS" : "EMP");
      }
      return data;
    },
    async beforeDelete(record) {
      const used = await Promise.all([
        Payslip.exists({ staffId: record._id }),
        Attendance.exists({ staffId: record._id }),
        Contract.exists({ staffId: record._id }),
      ]);
      if (used.some(Boolean))
        throw httpError(
          409,
          "Cette personne a déjà des contrats, des présences ou des bulletins. Passez son statut à « Parti » pour conserver l’historique.",
        );
    },
  });

  // Documents du dossier (pièce d’identité, diplômes, CV…).
  router.get(
    "/documents",
    permit("rh.contracts", "view"),
    wrap(async (req, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
      const filter = { "documents.0": { $exists: true } };
      if (q) filter.fullName = { $regex: escapeRegex(q), $options: "i" };
      const staff = await Staff.find(filter)
        .select("fullName reference kind documents")
        .sort({ fullName: 1 })
        .lean();
      res.json({
        items: staff.flatMap((member) =>
          member.documents.map((document) => ({
            ...document,
            staffId: member._id,
            staffName: member.fullName,
            staffReference: member.reference,
            staffKind: member.kind,
          })),
        ),
      });
    }),
  );
  router.post(
    "/staff/:id/documents",
    permit("rh.contracts", "create"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const data = parseBody(documentSchema, req.body, labels);
      const staff = await Staff.findByIdAndUpdate(
        req.params.id,
        { $push: { documents: data } },
        { new: true },
      );
      if (!staff) throw httpError(404, "Personne introuvable.");
      res.status(201).json({ item: staff.documents.at(-1) });
    }),
  );
  router.delete(
    "/staff/:id/documents/:documentId",
    permit("rh.contracts", "delete"),
    wrap(async (req, res) => {
      if (!validId(req.params.id) || !validId(req.params.documentId))
        throw httpError(400, "Identifiant invalide.");
      await Staff.updateOne(
        { _id: req.params.id },
        { $pull: { documents: { _id: req.params.documentId } } },
      );
      res.json({ message: "Document retiré du dossier." });
    }),
  );

  crudRoutes(router, {
    path: "/contracts",
    model: Contract,
    schema: contractSchema,
    labels,
    section: "rh.contracts",
    filters: { ...byStaff, status: (value) => ({ status: value }) },
    populate: [person],
    sort: { startDate: -1 },
    readOnly: ["reference"],
    async prepare(data, { record }) {
      if (data.staffId) await ensureStaff(data.staffId);
      if (data.endDate && data.endDate < (data.startDate || record?.startDate))
        throw httpError(400, "La date de fin précède la date de début.");
      if (!record) data.reference = await nextNumber("CTR");
      return data;
    },
  });

  // Affectations récurrentes et planning.
  crudRoutes(router, {
    path: "/assignments",
    model: Assignment,
    schema: assignmentSchema,
    labels,
    section: "rh.planning",
    filters: {
      ...byStaff,
      active: (value) => ({ active: value === "true" }),
      kind: (value) => ({ kind: value }),
    },
    populate: [person],
    sort: { active: -1, startTime: 1 },
    async prepare(data) {
      if (data.staffId) await ensureStaff(data.staffId);
      return data;
    },
  });
  crudRoutes(router, {
    path: "/planning",
    model: PlanningEntry,
    schema: planningSchema,
    labels,
    section: "rh.planning",
    dateField: "date",
    filters: { ...byStaff, status: (value) => ({ status: value }) },
    populate: [person, ["replacementStaffId", "fullName"]],
    sort: { date: 1, startTime: 1 },
    async prepare(data) {
      if (data.staffId) await ensureStaff(data.staffId);
      return data;
    },
  });
  router.post(
    "/planning/generate",
    permit("rh.planning", "create"),
    wrap(async (req, res) => {
      const { month, staffIds } = parseBody(
        z.object({ month: v.month, staffIds: z.array(v.id).max(500).optional() }),
        req.body,
        { month: "Mois" },
      );
      res.json(await generatePlanning(month, staffIds));
    }),
  );
  router.post(
    "/planning/clear",
    permit("rh.planning", "delete"),
    wrap(async (req, res) => {
      const { month } = parseBody(z.object({ month: v.month }), req.body);
      // Seules les séances générées et encore « prévues » sont retirées.
      const { deletedCount } = await PlanningEntry.deleteMany({
        date: { $gte: `${month}-01`, $lte: `${month}-31` },
        status: "planned",
        assignmentId: { $exists: true },
      });
      res.json({ deleted: deletedCount });
    }),
  );

  // Présences et heures.
  crudRoutes(router, {
    path: "/attendance",
    model: Attendance,
    schema: attendanceSchema,
    labels,
    section: "rh.attendance",
    dateField: "date",
    filters: {
      ...byStaff,
      status: (value) => ({ status: value }),
      validated: (value) => ({ validated: value === "true" }),
    },
    populate: [person, ["replacementStaffId", "fullName"]],
    sort: { date: -1, startTime: 1 },
    readOnly: ["validated", "validatedBy", "validatedAt", "planningId"],
    async prepare(data, { req, record }) {
      if (record?.validated && !can(req.admin, "rh.attendance", "approve"))
        throw httpError(409, "Cette présence est validée. Seul un responsable peut la modifier.");
      if (data.staffId) await ensureStaff(data.staffId);
      const merged = { ...(record?.toObject() || {}), ...data };
      if (["absent", "excused", "leave"].includes(merged.status)) data.hours = 0;
      else if (data.hours === undefined && merged.startTime && merged.endTime)
        data.hours = hoursBetween(merged.startTime, merged.endTime);
      if (merged.status === "late" && !merged.lateMinutes && merged.startTime) {
        const planned = merged.planningId
          ? await PlanningEntry.findById(merged.planningId).lean()
          : null;
        if (planned) {
          const [h1, m1] = planned.startTime.split(":").map(Number);
          const [h2, m2] = merged.startTime.split(":").map(Number);
          data.lateMinutes = Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
        }
      }
      return data;
    },
    async beforeDelete(record, req) {
      if (record.validated && !can(req.admin, "rh.attendance", "approve"))
        throw httpError(409, "Cette présence est validée. Seul un responsable peut la supprimer.");
    },
  });
  router.post(
    "/attendance/from-planning",
    permit("rh.attendance", "create"),
    wrap(async (req, res) => {
      const { date } = parseBody(z.object({ date: v.day }), req.body, labels);
      res.json(await attendanceFromPlanning(date));
    }),
  );
  router.post(
    "/attendance/validate",
    permit("rh.attendance", "approve"),
    wrap(async (req, res) => {
      const { ids, validated } = parseBody(
        z.object({ ids: z.array(v.id).min(1).max(1000), validated: z.boolean().default(true) }),
        req.body,
      );
      const { modifiedCount } = await Attendance.updateMany(
        { _id: { $in: ids } },
        validated
          ? { $set: { validated: true, validatedBy: actor(req), validatedAt: new Date() } }
          : { $set: { validated: false }, $unset: { validatedBy: 1, validatedAt: 1 } },
      );
      res.json({ updated: modifiedCount });
    }),
  );

  // Congés et absences.
  crudRoutes(router, {
    path: "/leaves",
    model: Leave,
    schema: leaveSchema,
    labels,
    section: "rh.leaves",
    dateField: "startDate",
    filters: {
      ...byStaff,
      status: (value) => ({ status: value }),
      type: (value) => ({ type: value }),
    },
    populate: [person, ["replacementStaffId", "fullName"]],
    sort: { startDate: -1 },
    readOnly: ["status", "decidedBy", "decidedAt"],
    async prepare(data, { record }) {
      if (record && record.status !== "pending")
        throw httpError(409, "Une demande déjà traitée ne se modifie plus. Créez-en une nouvelle.");
      if (data.staffId) await ensureStaff(data.staffId);
      const start = data.startDate || record?.startDate;
      const end = data.endDate || record?.endDate;
      if (end < start) throw httpError(400, "La date de fin précède la date de début.");
      if (data.days === undefined && (data.startDate || data.endDate)) {
        const { weekend } = await getSettings("hr");
        data.days = leaveDates({ startDate: start, endDate: end }, weekend).length;
      }
      return data;
    },
    async beforeDelete(record) {
      if (record.status === "approved")
        throw httpError(409, "Un congé approuvé ne se supprime pas : annulez-le.");
    },
  });
  router.post(
    "/leaves/:id/decision",
    permit("rh.leaves", "approve"),
    wrap(async (req, res) => {
      const { status } = parseBody(
        z.object({ status: z.enum(["approved", "rejected", "cancelled"]) }),
        req.body,
      );
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const leave = await Leave.findById(req.params.id);
      if (!leave) throw httpError(404, "Demande introuvable.");
      leave.set({ status, decidedBy: actor(req), decidedAt: new Date() });
      await leave.save();
      // Les séances prévues pendant le congé sont remplacées ou annulées.
      let planning = 0;
      if (status === "approved") {
        const result = await PlanningEntry.updateMany(
          {
            staffId: leave.staffId,
            status: "planned",
            date: { $gte: leave.startDate, $lte: leave.endDate },
          },
          leave.replacementStaffId
            ? { $set: { status: "replaced", replacementStaffId: leave.replacementStaffId } }
            : { $set: { status: "cancelled", notes: "Congé / absence approuvé" } },
        );
        planning = result.modifiedCount;
      }
      res.json({ item: leave, planning });
    }),
  );

  // Primes, retenues et avances.
  crudRoutes(router, {
    path: "/adjustments",
    model: PayAdjustment,
    schema: adjustmentSchema,
    labels,
    section: "rh.adjustments",
    filters: {
      ...byStaff,
      type: (value) => ({ type: value }),
      status: (value) => ({ status: value }),
      period: (value) => ({ period: value }),
    },
    populate: [person],
    sort: { period: -1, createdAt: -1 },
    readOnly: ["status", "decidedBy", "decidedAt", "disbursed"],
    async prepare(data, { record }) {
      if (record && record.status !== "pending")
        throw httpError(409, "Un élément déjà validé ne se modifie plus.");
      if (data.staffId) await ensureStaff(data.staffId);
      const type = data.type || record?.type;
      if (type === "advance" && !data.repaymentStart && !record?.repaymentStart)
        data.repaymentStart = data.period;
      return data;
    },
    async beforeDelete(record) {
      if (record.status === "approved")
        throw httpError(409, "Un élément validé ne se supprime pas : annulez-le.");
    },
  });
  router.post(
    "/adjustments/:id/decision",
    permit("rh.adjustments", "approve"),
    wrap(async (req, res) => {
      const { status } = parseBody(
        z.object({ status: z.enum(["approved", "rejected", "cancelled"]) }),
        req.body,
      );
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const item = await PayAdjustment.findById(req.params.id);
      if (!item) throw httpError(404, "Élément introuvable.");
      if (status === "cancelled" && item.disbursed?.paid)
        throw httpError(409, "Cette avance a déjà été versée : elle sera retenue sur les salaires.");
      item.set({ status, decidedBy: actor(req), decidedAt: new Date() });
      await item.save();
      res.json({ item });
    }),
  );

  // Tarifs horaires et salaires.
  router.get(
    "/rates",
    permit("rh.rates", "view"),
    wrap(async (req, res) => {
      const filter = { status: { $ne: "left" } };
      if (["teacher", "employee"].includes(req.query.kind)) filter.kind = req.query.kind;
      if (typeof req.query.q === "string" && req.query.q)
        filter.fullName = { $regex: escapeRegex(req.query.q.slice(0, 100)), $options: "i" };
      const items = await Staff.find(filter)
        .select(`fullName reference kind position specialty status ${payFields.join(" ")}`)
        .sort({ kind: 1, fullName: 1 })
        .lean();
      res.json({ items, total: items.length });
    }),
  );
  router.patch(
    "/rates/:id",
    permit("rh.rates", "update"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const data = parseBody(ratesSchema.partial(), req.body);
      const item = await Staff.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
      if (!item) throw httpError(404, "Personne introuvable.");
      res.json({ item });
    }),
  );

  // Paie : calcul, bulletins, validation.
  router.post(
    "/payroll/calculate",
    permit("rh.payroll", "create"),
    wrap(async (req, res) => {
      const { period, staffIds } = parseBody(
        z.object({ period: v.month, staffIds: z.array(v.id).max(500).optional() }),
        req.body,
        { period: "Mois" },
      );
      const { currency } = await getSettings("finance");
      res.json(await calculatePayroll(period, staffIds, currency));
    }),
  );
  router.get(
    "/payslips",
    permit("rh.payroll", "view"),
    wrap(async (req, res) => {
      const filter = {};
      if (/^\d{4}-\d{2}$/.test(req.query.period || "")) filter.period = req.query.period;
      if (["teacher", "employee"].includes(req.query.kind)) filter["staff.kind"] = req.query.kind;
      if (["draft", "validated", "partial", "paid"].includes(req.query.status))
        filter.status = req.query.status;
      if (validId(req.query.staffId)) filter.staffId = req.query.staffId;
      if (typeof req.query.q === "string" && req.query.q)
        filter["staff.name"] = { $regex: escapeRegex(req.query.q.slice(0, 100)), $options: "i" };
      const items = await Payslip.find(filter)
        .sort({ period: -1, "staff.name": 1 })
        .limit(req.query.all === "1" ? 2000 : 500)
        .lean();
      res.json({ items, total: items.length });
    }),
  );
  router.get(
    "/payslips/:id",
    permit("rh.payroll", "view"),
    wrap(async (req, res) => {
      if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
      const item = await Payslip.findById(req.params.id)
        .populate("staffId", "fullName reference kind position specialty paymentMethod paymentAccount hireDate")
        .lean();
      if (!item) throw httpError(404, "Bulletin introuvable.");
      res.json({ item });
    }),
  );
  router.patch(
    "/payslips/:id",
    permit("rh.payroll", "update"),
    wrap(async (req, res) => {
      const { notes } = parseBody(z.object({ notes: v.text(1000) }), req.body);
      const item = await Payslip.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Bulletin introuvable.");
      item.notes = notes;
      await item.save();
      res.json({ item });
    }),
  );
  router.post(
    "/payslips/:id/validate",
    permit("rh.payroll", "approve"),
    wrap(async (req, res) => {
      const item = await Payslip.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Bulletin introuvable.");
      if (item.status !== "draft") throw httpError(409, "Ce bulletin est déjà validé.");
      item.set({ status: "validated", validatedBy: actor(req), validatedAt: new Date() });
      await item.save();
      res.json({ item });
    }),
  );
  router.post(
    "/payslips/:id/reopen",
    permit("rh.payroll", "approve"),
    wrap(async (req, res) => {
      const item = await Payslip.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Bulletin introuvable.");
      if (
        item.paidAmount > 0 ||
        (await StaffPayment.exists({ payslipId: item._id, status: { $ne: "rejected" } }))
      )
        throw httpError(409, "Un paiement est déjà préparé ou versé pour ce bulletin.");
      item.set({ status: "draft" });
      item.validatedBy = undefined;
      item.validatedAt = undefined;
      await item.save();
      res.json({ item });
    }),
  );
  router.delete(
    "/payslips/:id",
    permit("rh.payroll", "delete"),
    wrap(async (req, res) => {
      const item = await Payslip.findById(validId(req.params.id) ? req.params.id : null);
      if (!item) throw httpError(404, "Bulletin introuvable.");
      if (item.status !== "draft")
        throw httpError(409, "Seul un bulletin brouillon peut être supprimé.");
      await item.deleteOne();
      res.json({ message: "Bulletin supprimé." });
    }),
  );

  router.get(
    "/dashboard",
    permit("rh.dashboard", "view"),
    wrap(async (_req, res) => {
      const day = today();
      const month = currentMonth();
      const soon = addDays(day, 30);
      const [
        headcount,
        planningToday,
        attendanceToday,
        pendingLeaves,
        onLeave,
        toValidate,
        payslips,
        contractsEnding,
        hoursByStaff,
        lates,
      ] = await Promise.all([
        Staff.aggregate([{ $group: { _id: { kind: "$kind", status: "$status" }, count: { $sum: 1 } } }]),
        PlanningEntry.find({ date: day, status: { $ne: "cancelled" } })
          .populate(...person)
          .sort({ startTime: 1 })
          .limit(50)
          .lean(),
        Attendance.aggregate([{ $match: { date: day } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        Leave.find({ status: "pending" }).populate(...person).sort({ startDate: 1 }).limit(8).lean(),
        Leave.find({ status: "approved", startDate: { $lte: day }, endDate: { $gte: day } })
          .populate(...person)
          .lean(),
        Attendance.countDocuments({ validated: false, date: { $lte: day } }),
        Payslip.aggregate([
          { $match: { period: month } },
          { $group: { _id: "$status", net: { $sum: "$net" }, paid: { $sum: "$paidAmount" }, count: { $sum: 1 } } },
        ]),
        Contract.find({ status: "active", endDate: { $gte: day, $lte: soon } })
          .populate(...person)
          .sort({ endDate: 1 })
          .lean(),
        Attendance.aggregate([
          { $match: { date: { $gte: `${month}-01`, $lte: `${month}-31` }, status: { $in: ["present", "late"] } } },
          { $group: { _id: "$staffId", hours: { $sum: "$hours" } } },
          { $sort: { hours: -1 } },
          { $limit: 8 },
          { $lookup: { from: "hr_staff", localField: "_id", foreignField: "_id", as: "staff" } },
        ]),
        Attendance.countDocuments({ date: { $gte: `${month}-01`, $lte: `${month}-31` }, status: "late" }),
      ]);
      const count = (kind, status) =>
        headcount
          .filter((row) => row._id.kind === kind && (!status || row._id.status === status))
          .reduce((sum, row) => sum + row.count, 0);
      res.json({
        month,
        counts: {
          teachers: count("teacher", "active"),
          employees: count("employee", "active"),
          inactive: count("teacher", "inactive") + count("employee", "inactive"),
          pendingLeaves: pendingLeaves.length,
          onLeave: onLeave.length,
          toValidate,
          lates,
        },
        attendanceToday: Object.fromEntries(attendanceToday.map((row) => [row._id, row.count])),
        planningToday,
        pendingLeaves,
        onLeave,
        contractsEnding,
        payroll: {
          net: payslips.reduce((sum, row) => sum + row.net, 0),
          paid: payslips.reduce((sum, row) => sum + row.paid, 0),
          drafts: payslips.find((row) => row._id === "draft")?.count || 0,
          count: payslips.reduce((sum, row) => sum + row.count, 0),
        },
        hoursByStaff: hoursByStaff.map((row) => ({
          staffId: row._id,
          name: row.staff[0]?.fullName || "—",
          hours: Math.round(row.hours * 100) / 100,
        })),
      });
    }),
  );

  router.get(
    "/reports",
    permit("rh.reports", "view"),
    wrap(async (req, res) => {
      const from = /^\d{4}-\d{2}$/.test(req.query.from || "") ? req.query.from : currentMonth();
      const to = /^\d{4}-\d{2}$/.test(req.query.to || "") ? req.query.to : from;
      const [staff, attendance, leaves, payslips] = await Promise.all([
        Staff.find().select("fullName reference kind status position specialty payType").sort({ fullName: 1 }).lean(),
        Attendance.aggregate([
          { $match: { date: { $gte: `${from}-01`, $lte: `${to}-31` } } },
          {
            $group: {
              _id: "$staffId",
              hours: { $sum: { $cond: ["$validated", "$hours", 0] } },
              pendingHours: { $sum: { $cond: ["$validated", 0, "$hours"] } },
              lates: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
              lateMinutes: { $sum: "$lateMinutes" },
              absences: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
              sessions: { $sum: 1 },
            },
          },
        ]),
        Leave.aggregate([
          { $match: { status: "approved", startDate: { $lte: `${to}-31` }, endDate: { $gte: `${from}-01` } } },
          { $group: { _id: "$staffId", days: { $sum: "$days" } } },
        ]),
        Payslip.find({ period: { $gte: from, $lte: to } }).select("staffId period net paidAmount status").lean(),
      ]);
      const pick = (rows, id) => rows.find((row) => String(row._id) === String(id));
      const monthly = {};
      for (const slip of payslips) {
        monthly[slip.period] ||= { month: slip.period, net: 0, paid: 0 };
        monthly[slip.period].net += slip.net;
        monthly[slip.period].paid += slip.paidAmount;
      }
      res.json({
        from,
        to,
        rows: staff.map((member) => {
          const work = pick(attendance, member._id) || {};
          const mine = payslips.filter((slip) => String(slip.staffId) === String(member._id));
          return {
            ...member,
            hours: Math.round((work.hours || 0) * 100) / 100,
            pendingHours: Math.round((work.pendingHours || 0) * 100) / 100,
            sessions: work.sessions || 0,
            lates: work.lates || 0,
            lateMinutes: work.lateMinutes || 0,
            absences: work.absences || 0,
            leaveDays: pick(leaves, member._id)?.days || 0,
            net: mine.reduce((sum, slip) => sum + slip.net, 0),
            paid: mine.reduce((sum, slip) => sum + slip.paidAmount, 0),
          };
        }),
        monthly: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)),
      });
    }),
  );

  router.get("/settings", permit("rh.settings", "view"), wrap(async (_req, res) => {
    res.json({ settings: await getSettings("hr") });
  }));
  router.put("/settings", permit("rh.settings", "update"), wrap(async (req, res) => {
    const result = await saveSettings("hr", req.body, req.admin);
    if (result.error) throw httpError(400, result.error);
    res.json(result);
  }));
  return router;
}
