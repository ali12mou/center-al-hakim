import mongoose from "mongoose";
import { PROSPECT_STATUS, PROSPECT_SOURCES } from "../config/marketing.js";

// Marketing et prospection : agents (comptes séparés des administrateurs),
// prospects collectés, historique des statuts et journal d’activité.
const options = { timestamps: true };
const text = { type: String, trim: true };
const day = { ...text, match: /^\d{4}-\d{2}-\d{2}$/ };
const ref = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});
// Auteur d’une action : un agent (portail) ou un administrateur.
const actorSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["agent", "admin"], required: true },
    id: { type: mongoose.Schema.Types.ObjectId },
    name: { ...text, default: "" },
  },
  { _id: false },
);

const agentSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    name: { ...text, required: true, maxlength: 120 },
    phone: { ...text, maxlength: 30, default: "" },
    // Identifiant de connexion au portail.
    email: { ...text, required: true, unique: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    createdBy: actorSchema,
  },
  options,
);

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    agentId: ref("MarketingAgent"),
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, default: Date.now },
    ip: { ...text, default: "" },
    userAgent: { ...text, default: "" },
  },
  options,
);
sessionSchema.index({ agentId: 1, createdAt: -1 });

const prospectSchema = new mongoose.Schema(
  {
    reference: { ...text, required: true, unique: true },
    name: { ...text, required: true, maxlength: 120 },
    phone: { ...text, required: true, maxlength: 30 },
    // Prévention des doublons : 8 derniers chiffres du téléphone.
    phoneKey: { ...text, required: true, index: true },
    email: { ...text, lowercase: true, maxlength: 254, default: "" },
    courseId: { ...text, required: true },
    courseTitle: { ...text, default: "" },
    status: { type: String, enum: Object.keys(PROSPECT_STATUS), default: "new", index: true },
    source: { type: String, enum: Object.keys(PROSPECT_SOURCES), default: "field" },
    notes: { ...text, maxlength: 2000, default: "" },
    // Accord pour recevoir les informations commerciales du centre.
    consent: { type: Boolean, default: false },
    nextFollowUp: { ...day, default: undefined },
    agentId: ref("MarketingAgent", false),
    agentName: { ...text, default: "" },
    // Dossier d’inscription relié quand le prospect devient student.
    registrationId: ref("Registration", false),
    registrationReference: { ...text, default: "" },
    statusChangedAt: { type: Date, default: Date.now },
    createdBy: actorSchema,
  },
  options,
);
prospectSchema.index({ agentId: 1, createdAt: -1 });
prospectSchema.index({ createdAt: -1 });
prospectSchema.index({ email: 1 });

const followupSchema = new mongoose.Schema(
  {
    prospectId: ref("MarketingProspect"),
    from: { ...text, default: "" },
    to: { ...text, required: true },
    note: { ...text, maxlength: 1000, default: "" },
    nextFollowUp: { ...day, default: undefined },
    by: actorSchema,
  },
  options,
);
followupSchema.index({ prospectId: 1, createdAt: -1 });

export const AGENT_ACTIONS = {
  login: "Connexion",
  logout: "Déconnexion",
  password_changed: "Mot de passe modifié",
  prospect_created: "Prospect enregistré",
  prospect_updated: "Prospect modifié",
  status_changed: "Statut modifié",
};
const activitySchema = new mongoose.Schema({
  agentId: ref("MarketingAgent"),
  action: { type: String, enum: Object.keys(AGENT_ACTIONS), required: true },
  prospectId: ref("MarketingProspect", false),
  details: { ...text, maxlength: 300, default: "" },
  ip: { ...text, default: "" },
  // Journal conservé un an.
  createdAt: { type: Date, default: Date.now, expires: 365 * 24 * 60 * 60 },
});
activitySchema.index({ agentId: 1, createdAt: -1 });

export const MarketingAgent = mongoose.model("MarketingAgent", agentSchema, "marketing_agents");
export const MarketingSession = mongoose.model("MarketingSession", sessionSchema, "marketing_sessions");
export const MarketingProspect = mongoose.model("MarketingProspect", prospectSchema, "marketing_prospects");
export const MarketingFollowup = mongoose.model("MarketingFollowup", followupSchema, "marketing_followups");
export const MarketingActivity = mongoose.model("MarketingActivity", activitySchema, "marketing_activity_logs");

export const marketingModels = [
  MarketingAgent,
  MarketingSession,
  MarketingProspect,
  MarketingFollowup,
  MarketingActivity,
];
