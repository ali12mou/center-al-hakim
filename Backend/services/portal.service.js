import { randomBytes } from "node:crypto";
import { PortalPublication, StudentCard } from "../models/portal.models.js";
import { StudentUser, Lesson, Announcement } from "../models/student.models.js";
import { StudentAccount } from "../models/finance.models.js";
import { PlanningEntry as Planning } from "../models/hr.models.js";
import { nextNumber } from "../models/system.models.js";
import { centre } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";
import { httpError } from "./crud.js";
import { getPublicCentre } from "./site.service.js";

export const localDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Djibouti" }).format(new Date());
export function courseScope(accounts, global = false) {
  const pairs = accounts.filter(account=>account.courseId).map(account=>({courseId:account.courseId,groupId:{$in:["",null,...(account.groupId?[account.groupId]:[])]}}));
  if(global) pairs.push({courseId:"",groupId:{$in:["",null,...accounts.map(account=>account.groupId).filter(Boolean)]}});
  return {$or:pairs.length?pairs:[{courseId:{$in:[]}}]};
}
export async function publicationsFor(audience, accounts = [], now = localDay()) {
  const courseIds = accounts.map(account => account.courseId).filter(Boolean);
  const groups = accounts.map(account => account.groupId).filter(Boolean);
  return PortalPublication.find({ published: true, archived: { $ne: true }, audiences: audience,
    ...courseScope(accounts,true),
    $and: [
      { $or: [{ startsAt: "" }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: "" }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  }).sort({ order: 1, createdAt: -1 }).limit(50).select("title description body imageUrl buttonLabel buttonLink order placement").lean();
}
export async function studentHome(student) {
  const accounts = await StudentAccount.find({ _id: { $in: student.accountIds }, status: { $ne: "cancelled" } }).lean();
  const courses = accounts.map(account => account.courseId).filter(Boolean);
  const groups = accounts.map(account => account.groupId).filter(Boolean);
  const [banners, sessions, lessons, announcements] = await Promise.all([
    publicationsFor("student", accounts),
    Planning.find({ ...courseScope(accounts), date: { $gte: localDay() }, status: { $nin: ["cancelled", "done"] } })
      .sort({ date: 1, startTime: 1 }).limit(6).populate("staffId", "fullName").select("date startTime endTime room label courseId staffId").lean(),
    Lesson.find({ ...courseScope(accounts), published: true }).sort({ createdAt: -1 }).limit(5).select("title kind courseId date createdAt").lean(),
    Announcement.find({ published: true, ...courseScope(accounts,true) }).sort({ pinned: -1, date: -1 }).limit(6).lean(),
  ]);
  return { centre:await getPublicCentre(), about: siteContent.about, banners, sessions, lessons, announcements };
}
export async function getStudentCard(student, origin) {
  let card = await StudentCard.findOne({ studentId: student._id }).select("+token");
  if (!card) {
    try {
      card = await StudentCard.create({ studentId: student._id, token: randomBytes(32).toString("hex"),
        number: await nextNumber("ETU"), validFrom: new Date(), validUntil: new Date(Date.now() + 365 * 86400000) });
    } catch (error) {
      if (error.code !== 11000) throw error;
      card = await StudentCard.findOne({ studentId: student._id }).select("+token");
    }
  }
  const accounts = await StudentAccount.find({ _id: { $in: student.accountIds }, status: { $ne: "cancelled" } }).select("courseTitle groupId").lean();
  return { number: card.number, name: student.name, photoUrl: student.photoUrl || "", validFrom: card.validFrom, validUntil: card.validUntil,
    status: card.revokedAt || !student.active ? "revoked" : card.validUntil < new Date() ? "expired" : "valid",
    courses: accounts.map(account => account.courseTitle), verifyUrl: `${origin.replace(/\/$/, "")}/api/cards/verify/${card.token}` };
}
export async function verifyCard(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw httpError(404, "Carte introuvable.");
  const card = await StudentCard.findOne({ token }).lean();
  if (!card) throw httpError(404, "Carte introuvable.");
  const student = await StudentUser.findById(card.studentId).select("name active").lean();
  return { centre: centre.name, number: card.number, name: student?.name || "", validUntil: card.validUntil,
    status: card.revokedAt || !student?.active ? "revoked" : card.validUntil < new Date() ? "expired" : "valid" };
}
