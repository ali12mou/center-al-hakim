import mongoose from "mongoose";
const text = { type: String, trim: true, default: "" };
const publicationSchema = new mongoose.Schema({
  title: { ...text, required: true, maxlength: 200 },
  description: { ...text, maxlength: 2000 }, body: { ...text, maxlength: 15000 },
  imageUrl: text, buttonLabel: text, buttonLink: text,
  audiences: { type: [String], enum: ["public", "student", "marketing"], default: [] },
  courseId: text, groupId: text, startsAt: text, endsAt: text,
  order: { type: Number, default: 1 }, published: { type: Boolean, default: false },
  placement: { type: String, enum: ['banner','footer'], default: 'banner' },
  archived: { type: Boolean, default: false },
}, { timestamps: true });
publicationSchema.index({ published: 1, archived: 1, audiences: 1, order: 1 });
export const PortalPublication = mongoose.model("PortalPublication", publicationSchema, "portal_publications");
const cardSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentUser", unique: true, required: true },
  token: { type: String, required: true, unique: true, select: false },
  number: { type: String, required: true, unique: true },
  validFrom: { type: Date, required: true }, validUntil: { type: Date, required: true },
  revokedAt: Date,
}, { timestamps: true });
export const StudentCard = mongoose.model("StudentCard", cardSchema, "student_cards");
export const PortalAudit = mongoose.model("PortalAudit",new mongoose.Schema({actorId:mongoose.Schema.Types.ObjectId,actorRole:String,action:String,entityId:mongoose.Schema.Types.ObjectId,changes:mongoose.Schema.Types.Mixed},{timestamps:true}),"portal_audit");
export const portalModels = [PortalPublication, StudentCard, PortalAudit];
