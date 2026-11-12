import mongoose from "mongoose";

// Espace étudiant (application installable) : comptes, sessions et contenus
// de suivi. Totalement séparé de l’administration : un compte étudiant n’a
// ni rôle ni permission, et ses sessions vivent dans leur propre collection.
const options = { timestamps: true };
const text = { type: String, trim: true };
const day = { ...text, match: /^\d{4}-\d{2}-\d{2}$/ };
const ref = (model, required = true) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
});
const author = {
  id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  name: { ...text, default: "" },
};

const studentUserSchema = new mongoose.Schema(
  {
    name: { ...text, required: true, maxlength: 120 },
    username: { ...text, required: true, unique: true, lowercase: true, maxlength: 50 },
    passwordHash: { type: String, required: true, select: false },
    // Dossiers financiers (fin_student_accounts) du student : une ligne par formation.
    accountIds: { type: [ref("StudentAccount")], default: [] },
    phone: { ...text, maxlength: 30, default: "" },
    email: { ...text, lowercase: true, maxlength: 254, default: "" },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    createdBy: author,
  },
  options,
);
studentUserSchema.index({ accountIds: 1 });

const studentSessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    userId: ref("StudentUser"),
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, default: Date.now },
    ip: { ...text, default: "" },
    userAgent: { ...text, default: "" },
  },
  options,
);
studentSessionSchema.index({ userId: 1, createdAt: -1 });

export const LESSON_KINDS = ["lesson", "document", "video", "link"];
const lessonSchema = new mongoose.Schema(
  {
    courseId: { ...text, required: true },
    title: { ...text, required: true, maxlength: 200 },
    kind: { type: String, enum: LESSON_KINDS, default: "lesson" },
    description: { ...text, maxlength: 2000, default: "" },
    body: { ...text, maxlength: 15000, default: "" },
    // Document privé (/api/admin/files/…) ou lien externe (vidéo, site).
    fileUrl: { ...text, default: "" },
    link: { ...text, default: "" },
    date: { ...day, default: undefined },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    createdBy: author,
  },
  options,
);
lessonSchema.index({ courseId: 1, published: 1, order: 1 });

export const STUDENT_ATTENDANCE = ["present", "late", "absent", "excused"];
const attendanceSchema = new mongoose.Schema(
  {
    studentAccountId: ref("StudentAccount"),
    studentName: { ...text, default: "" },
    courseId: { ...text, default: "" },
    date: { ...day, required: true },
    status: { type: String, enum: STUDENT_ATTENDANCE, default: "present" },
    notes: { ...text, maxlength: 500, default: "" },
    recordedBy: author,
  },
  options,
);
attendanceSchema.index({ studentAccountId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ courseId: 1, date: -1 });

const gradeSchema = new mongoose.Schema(
  {
    studentAccountId: ref("StudentAccount"),
    studentName: { ...text, default: "" },
    courseId: { ...text, default: "" },
    title: { ...text, required: true, maxlength: 150 },
    date: { ...day, required: true },
    score: { type: Number, min: 0, required: true },
    maxScore: { type: Number, min: 1, default: 20 },
    comment: { ...text, maxlength: 1000, default: "" },
    published: { type: Boolean, default: true },
    recordedBy: author,
  },
  options,
);
gradeSchema.index({ studentAccountId: 1, date: -1 });
gradeSchema.index({ courseId: 1, date: -1 });

const announcementSchema = new mongoose.Schema(
  {
    title: { ...text, required: true, maxlength: 200 },
    body: { ...text, maxlength: 5000, default: "" },
    // Vide : tous les students ; sinon les students de cette formation.
    courseId: { ...text, default: "" },
    date: { ...day, required: true },
    pinned: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    createdBy: author,
  },
  options,
);
announcementSchema.index({ published: 1, courseId: 1, date: -1 });

export const StudentUser = mongoose.model("StudentUser", studentUserSchema, "student_users");
export const StudentSession = mongoose.model(
  "StudentSession",
  studentSessionSchema,
  "student_sessions",
);
export const Lesson = mongoose.model("Lesson", lessonSchema, "student_lessons");
export const StudentAttendance = mongoose.model(
  "StudentAttendance",
  attendanceSchema,
  "student_attendance",
);
export const Grade = mongoose.model("Grade", gradeSchema, "student_grades");
export const Announcement = mongoose.model(
  "Announcement",
  announcementSchema,
  "student_announcements",
);

export const studentModels = [
  StudentUser,
  StudentSession,
  Lesson,
  StudentAttendance,
  Grade,
  Announcement,
];
