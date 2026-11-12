import {
  Staff,
  Assignment,
  PlanningEntry,
  Attendance,
  Leave,
  PayAdjustment,
  Payslip,
} from "../models/hr.models.js";
import { nextNumber } from "../models/system.models.js";
import { getSettings } from "./settings.service.js";
import {
  addDays,
  addMonths,
  hoursBetween,
  monthDays,
  weekday,
} from "./dates.js";

export const formatMoney = (value, currency = "FDJ") =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(value || 0)).replace(/\s/g, " ")} ${currency}`;

// Jours d’un congé approuvé, hors jours non travaillés.
export function leaveDates(leave, weekend = []) {
  const dates = [];
  for (let date = leave.startDate; date <= leave.endDate; date = addDays(date, 1))
    if (!weekend.includes(weekday(date))) dates.push(date);
  return dates;
}

// Séances d’un mois à partir des affectations récurrentes. Les jours de congé
// approuvé de la personne sont sautés (et comptés dans `skipped`).
export function planMonth(assignments, month, leaves = []) {
  const off = new Map();
  for (const leave of leaves) {
    const key = String(leave.staffId);
    if (!off.has(key)) off.set(key, new Set());
    for (const date of leaveDates(leave)) off.get(key).add(date);
  }
  const entries = [];
  let skipped = 0;
  for (const assignment of assignments) {
    for (const date of monthDays(month)) {
      if (!assignment.weekdays.includes(weekday(date))) continue;
      if (date < assignment.startDate) continue;
      if (assignment.endDate && date > assignment.endDate) continue;
      if (off.get(String(assignment.staffId))?.has(date)) {
        skipped += 1;
        continue;
      }
      entries.push({
        staffId: assignment.staffId,
        assignmentId: assignment._id,
        date,
        shift: assignment.shift,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        label: assignment.label,
        courseId: assignment.courseId || "",
        room: assignment.room || "",
      });
    }
  }
  return { entries, skipped };
}

// Mensualité d’une avance pour un mois donné : montant ÷ nombre de mois,
// la dernière mensualité reprend le reste. Jamais plus que ce qui reste dû.
export function advanceInstallment(advance, period, alreadyDeducted = 0) {
  const months = Math.max(1, advance.repaymentMonths || 1);
  const start = advance.repaymentStart || advance.period;
  const remaining = Math.max(0, advance.amount - alreadyDeducted);
  if (!remaining || period < start || period > addMonths(start, months - 1))
    return 0;
  const share = Math.ceil(advance.amount / months);
  return period === addMonths(start, months - 1) ? remaining : Math.min(share, remaining);
}

// Bulletin d’un mois. `attendance` : présences validées du mois ;
// `adjustments` : primes, retenues et avances approuvées de la personne ;
// `deducted` : montant déjà retenu sur d’autres bulletins, par avance.
export function computePayslip({
  staff,
  period,
  attendance = [],
  adjustments = [],
  deducted = {},
  absenceDates = [],
  settings,
  currency = "FDJ",
}) {
  const lines = [];
  let hours = 0;
  if (staff.payType === "hourly") {
    hours = attendance
      .filter((entry) => ["present", "late"].includes(entry.status))
      .reduce((sum, entry) => sum + (entry.hours || 0), 0);
    hours = Math.round(hours * 100) / 100;
    lines.push({
      kind: "base",
      label: `${String(hours).replace(".", ",")} h validées × ${formatMoney(staff.hourlyRate, currency)}`,
      amount: Math.round(hours * staff.hourlyRate),
    });
  } else if (staff.payType === "flat")
    lines.push({ kind: "base", label: "Forfait convenu", amount: staff.flatAmount });
  else {
    lines.push({ kind: "base", label: "Salaire mensuel", amount: staff.monthlySalary });
    if (settings?.deductAbsences && absenceDates.length) {
      const daily = staff.monthlySalary / (settings.workingDaysPerMonth || 26);
      lines.push({
        kind: "absence",
        label: `Absences non rémunérées : ${absenceDates.length} j`,
        amount: Math.round(daily * absenceDates.length),
      });
    }
  }
  for (const item of adjustments) {
    if (item.type === "bonus" && item.period === period)
      lines.push({
        kind: "bonus",
        label: item.label || "Prime",
        amount: item.amount,
        adjustmentId: item._id,
      });
    if (item.type === "deduction" && item.period === period)
      lines.push({
        kind: "deduction",
        label: item.label || "Retenue",
        amount: item.amount,
        adjustmentId: item._id,
      });
    if (item.type === "advance" && item.disbursed?.paid) {
      const amount = advanceInstallment(item, period, deducted[String(item._id)] || 0);
      if (amount)
        lines.push({
          kind: "advance",
          label: `Remboursement d’avance${item.label ? ` (${item.label})` : ""}`,
          amount,
          adjustmentId: item._id,
        });
    }
  }
  const gross = lines
    .filter((line) => ["base", "bonus"].includes(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);
  const totalDeductions = lines
    .filter((line) => !["base", "bonus"].includes(line.kind))
    .reduce((sum, line) => sum + line.amount, 0);
  return {
    payType: staff.payType,
    hours,
    hourlyRate: staff.payType === "hourly" ? staff.hourlyRate : 0,
    lines,
    gross,
    totalDeductions,
    net: Math.max(0, gross - totalDeductions),
  };
}

export async function generatePlanning(month, staffIds) {
  const filter = { active: true, startDate: { $lte: `${month}-31` } };
  if (staffIds?.length) filter.staffId = { $in: staffIds };
  const assignments = (await Assignment.find(filter).lean()).filter(
    (item) => !item.endDate || item.endDate >= `${month}-01`,
  );
  const leaves = await Leave.find({
    status: "approved",
    startDate: { $lte: `${month}-31` },
    endDate: { $gte: `${month}-01` },
  }).lean();
  const { entries, skipped } = planMonth(assignments, month, leaves);
  let created = 0;
  if (entries.length) {
    const result = await PlanningEntry.bulkWrite(
      entries.map((entry) => ({
        updateOne: {
          filter: { assignmentId: entry.assignmentId, date: entry.date },
          update: { $setOnInsert: entry },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    created = result.upsertedCount;
  }
  return {
    created,
    existing: entries.length - created,
    skipped,
    assignments: assignments.length,
  };
}

// Prépare les présences d’une journée à partir du planning (statut « présent »,
// heures prévues) ; le responsable corrige puis valide.
export async function attendanceFromPlanning(date) {
  const planned = await PlanningEntry.find({
    date,
    status: { $in: ["planned", "done", "replaced"] },
  }).lean();
  let created = 0;
  for (const entry of planned) {
    const staffId =
      entry.status === "replaced" && entry.replacementStaffId
        ? entry.replacementStaffId
        : entry.staffId;
    const result = await Attendance.updateOne(
      { planningId: entry._id },
      {
        $setOnInsert: {
          staffId,
          planningId: entry._id,
          date,
          shift: entry.shift,
          startTime: entry.startTime,
          endTime: entry.endTime,
          hours: hoursBetween(entry.startTime, entry.endTime),
          classLabel: entry.label,
          status: "present",
        },
      },
      { upsert: true },
    );
    created += result.upsertedCount;
  }
  return { created, planned: planned.length };
}

// Calcule (ou recalcule) les bulletins brouillons d’un mois. Les bulletins
// validés ou payés ne sont jamais modifiés.
export async function calculatePayroll(period, staffIds, currency = "FDJ") {
  const settings = await getSettings("hr");
  const filter = { status: "active" };
  if (staffIds?.length) filter._id = { $in: staffIds };
  const staffList = await Staff.find(filter).lean();
  const locked = await Payslip.find({
    period,
    status: { $ne: "draft" },
  }).distinct("staffId");
  const lockedIds = new Set(locked.map(String));
  const ids = staffList.map((staff) => staff._id);
  const [attendance, adjustments, leaves, earlier] = await Promise.all([
    Attendance.find({
      staffId: { $in: ids },
      date: { $gte: `${period}-01`, $lte: `${period}-31` },
    }).lean(),
    PayAdjustment.find({ staffId: { $in: ids }, status: "approved" }).lean(),
    Leave.find({
      staffId: { $in: ids },
      status: "approved",
      type: { $in: ["unpaid", "absence_unjustified"] },
      startDate: { $lte: `${period}-31` },
      endDate: { $gte: `${period}-01` },
    }).lean(),
    // Retenues d’avance déjà faites sur les autres mois.
    Payslip.find({ staffId: { $in: ids }, period: { $ne: period } })
      .select("lines")
      .lean(),
  ]);
  const deducted = {};
  for (const slip of earlier)
    for (const line of slip.lines)
      if (line.kind === "advance" && line.adjustmentId)
        deducted[String(line.adjustmentId)] =
          (deducted[String(line.adjustmentId)] || 0) + line.amount;
  let calculated = 0;
  for (const staff of staffList) {
    if (lockedIds.has(String(staff._id))) continue;
    const mine = (entry) => String(entry.staffId) === String(staff._id);
    const absences = new Set(
      attendance
        .filter((entry) => mine(entry) && entry.status === "absent")
        .map((entry) => entry.date),
    );
    for (const leave of leaves.filter(mine))
      for (const date of leaveDates(leave, settings.weekend))
        if (date.startsWith(period)) absences.add(date);
    const result = computePayslip({
      staff,
      period,
      attendance: attendance.filter((entry) => mine(entry) && entry.validated),
      adjustments: adjustments.filter(mine),
      deducted,
      absenceDates: [...absences],
      settings,
      currency,
    });
    const existing = await Payslip.findOne({ staffId: staff._id, period });
    const snapshot = {
      name: staff.fullName,
      reference: staff.reference,
      kind: staff.kind,
      position: staff.position || staff.specialty,
    };
    if (existing) {
      existing.set({ ...result, staff: snapshot });
      await existing.save();
    } else
      await Payslip.create({
        ...result,
        staff: snapshot,
        staffId: staff._id,
        period,
        reference: await nextNumber("BUL"),
      });
    calculated += 1;
  }
  return { calculated, locked: lockedIds.size, staff: staffList.length };
}
