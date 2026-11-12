import mongoose from "mongoose";

const text = { type: String, trim: true };

// Journal des appels à l’API d’administration (écran Sécurité), gardé 30 jours.
const apiLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  username: { ...text, default: "" },
  method: { ...text, required: true },
  path: { ...text, required: true },
  status: { type: Number, required: true },
  ms: { type: Number, default: 0 },
  ip: { ...text, default: "" },
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 },
});
apiLogSchema.index({ createdAt: -1 });
apiLogSchema.index({ userId: 1, createdAt: -1 });

// Fréquentation du site public : compteurs par jour et par page, sans
// adresse IP ni cookie (aucune donnée personnelle).
const visitSchema = new mongoose.Schema(
  {
    _id: String,
    day: { ...text, required: true },
    path: { ...text, required: true },
    views: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
  },
  { versionKey: false },
);
visitSchema.index({ day: 1 });

// Paramètres RH et finances : un document par module.
const settingSchema = new mongoose.Schema(
  {
    _id: String,
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { ...text, default: "" },
  },
  { timestamps: true, minimize: false },
);

// Numérotation continue des pièces : FAC-2026-0001, REC-2026-0001…
const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { versionKey: false },
);

export const ApiLog = mongoose.model("ApiLog", apiLogSchema, "admin_api_logs");
export const SiteVisit = mongoose.model("SiteVisit", visitSchema, "site_visits");
export const ModuleSetting = mongoose.model(
  "ModuleSetting",
  settingSchema,
  "module_settings",
);
export const Counter = mongoose.model("Counter", counterSchema, "counters");

export async function nextNumber(prefix, date = new Date()) {
  const year = date.getUTCFullYear();
  const { seq } = await Counter.findOneAndUpdate(
    { _id: `${prefix}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export const systemModels = [ApiLog, SiteVisit, ModuleSetting, Counter];
