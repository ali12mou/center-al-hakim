import mongoose from "mongoose";

const options = { timestamps: true };
const text = { type: String, trim: true };
const publishFields = {
  title: { ...text, required: true, maxlength: 200 },
  description: { ...text, maxlength: 2000, default: "" },
  body: { ...text, maxlength: 15000, default: "" },
  published: { type: Boolean, default: false },
  imageUrl: { ...text, default: "" },
};
const personFields = {
  reference: { ...text, required: true, unique: true },
  name: { ...text, required: true, maxlength: 100 },
  email: { ...text, required: true, maxlength: 254 },
  phone: { ...text, required: true, maxlength: 30 },
  courseId: { ...text, default: "" },
  schedule: {
    type: String,
    enum: ["matin", "soir", "week-end", "flexible"],
    default: "flexible",
  },
  message: { ...text, maxlength: 2000, default: "" },
  consent: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ["new", "contacted", "confirmed", "closed"],
    default: "new",
  },
};

const userSchema = new mongoose.Schema(
  {
    name: { ...text, required: true },
    username: { ...text, required: true, unique: true, lowercase: true },
    email: { ...text, required: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin"], default: "admin" },
    bootstrap: { type: Boolean, default: false },
    // Un mot de passe temporaire (script de réinitialisation) doit être remplacé.
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date,
    lastLoginAt: Date,
  },
  options,
);
// Empêche deux créations concurrentes du tout premier administrateur.
userSchema.index(
  { bootstrap: 1 },
  { unique: true, partialFilterExpression: { bootstrap: true } },
);

const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      required: true,
    },
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, default: Date.now },
    ip: { ...text, default: "" },
    userAgent: { ...text, default: "" },
  },
  options,
);
sessionSchema.index({ userId: 1, createdAt: -1 });

// Échecs de connexion par identifiant haché, que le compte existe ou non :
// le verrouillage ne révèle donc pas quels identifiants sont valides.
const loginThrottleSchema = new mongoose.Schema({
  _id: String,
  failures: { type: Number, default: 0 },
  lockedUntil: Date,
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const auditEvents = [
  "setup",
  "login_success",
  "login_failure",
  "login_locked",
  "logout",
  "password_changed",
  "password_change_failed",
  "password_reset",
  "sessions_revoked",
];
const auditSchema = new mongoose.Schema({
  event: { type: String, enum: auditEvents, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  username: { ...text, default: "" },
  ip: { ...text, default: "" },
  userAgent: { ...text, default: "" },
  // Le journal de sécurité est conservé 180 jours.
  createdAt: { type: Date, default: Date.now, expires: 180 * 24 * 60 * 60 },
});
auditSchema.index({ userId: 1, event: 1, createdAt: -1 });

const registrationSchema = new mongoose.Schema(
  {
    ...personFields,
    username: { ...text, lowercase: true, maxlength: 50, default: "" },
    passwordHash: { type: String, select: false, default: "" },
    hasPassword: { type: Boolean, default: false },
    profile: {
      type: String,
      enum: ["apprenant", "professionnel", "entreprise"],
      default: "apprenant",
    },
  },
  options,
);
registrationSchema.index({ createdAt: -1, courseId: 1 });

const contactSchema = new mongoose.Schema(
  {
    ...personFields,
    kind: { type: String, enum: ["contact", "enterprise"], default: "contact" },
  },
  options,
);
contactSchema.index({ createdAt: -1, status: 1 });

const skillSchema = new mongoose.Schema(
  {
    ...publishFields,
    category: { ...text, default: "informatique" },
    icon: { ...text, default: "GraduationCap" },
  },
  options,
);
const articleSchema = new mongoose.Schema(
  {
    ...publishFields,
    author: { ...text, default: "AL-HAKIM CENTER" },
    category: { ...text, default: "Actualités" },
  },
  options,
);
const informationSchema = new mongoose.Schema(
  { ...publishFields, category: { ...text, default: "Centre" } },
  options,
);
const businessSchema = new mongoose.Schema(
  {
    ...publishFields,
    benefits: [String],
    audience: { ...text, default: "Entreprises et institutions" },
  },
  options,
);
const certificationSchema = new mongoose.Schema(
  {
    ...publishFields,
    issuer: { ...text, default: "AL-HAKIM CENTER" },
    requirements: [String],
    accreditation: {
      ...text,
      default: "Attestation du centre — modalités à confirmer",
    },
  },
  options,
);
const questionSchema = new mongoose.Schema(
  {
    prompt: { ...text, required: true },
    choices: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 5 },
  },
  { _id: false },
);
const assessmentSchema = new mongoose.Schema(
  {
    ...publishFields,
    skill: { ...text, default: "Informatique" },
    questions: { type: [questionSchema], default: [] },
  },
  options,
);
const attemptSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    name: { ...text, required: true },
    email: { ...text, required: true },
    phone: { ...text, default: "" },
    answers: [Number],
    score: Number,
    total: Number,
    recommendation: String,
    consent: { type: Boolean, required: true },
  },
  options,
);
const partnerSchema = new mongoose.Schema(
  {
    ...publishFields,
    website: { ...text, default: "" },
    relationship: {
      type: String,
      enum: ["ecosystem", "pending", "partner"],
      default: "pending",
    },
  },
  options,
);

export const AdminUser = mongoose.model("AdminUser", userSchema, "admin_users");
export const AdminSession = mongoose.model(
  "AdminSession",
  sessionSchema,
  "admin_sessions",
);
export const LoginThrottle = mongoose.model(
  "LoginThrottle",
  loginThrottleSchema,
  "admin_login_throttle",
);
export const AdminAudit = mongoose.model("AdminAudit", auditSchema, "admin_audit");
export const Registration = mongoose.model(
  "Registration",
  registrationSchema,
  "registrations",
);
export const Contact = mongoose.model("Contact", contactSchema, "contacts");
export const Skill = mongoose.model("Skill", skillSchema, "competences");
export const Information = mongoose.model(
  "Information",
  informationSchema,
  "informations",
);
export const BlogPost = mongoose.model("BlogPost", articleSchema, "blog_posts");
export const Business = mongoose.model(
  "Business",
  businessSchema,
  "businesses",
);
export const Certification = mongoose.model(
  "Certification",
  certificationSchema,
  "certifications",
);
export const Assessment = mongoose.model(
  "Assessment",
  assessmentSchema,
  "skill_assessments",
);
export const AssessmentAttempt = mongoose.model(
  "AssessmentAttempt",
  attemptSchema,
  "assessment_attempts",
);
export const Partner = mongoose.model("Partner", partnerSchema, "partners");
export const PlatformSetting = mongoose.model(
  "PlatformSetting",
  new mongoose.Schema({ _id: String, initializedAt: Date }),
  "settings",
);

export const platformModels = [
  AdminUser,
  AdminSession,
  LoginThrottle,
  AdminAudit,
  Registration,
  Contact,
  Skill,
  Information,
  BlogPost,
  Business,
  Certification,
  Assessment,
  AssessmentAttempt,
  Partner,
  PlatformSetting,
];
