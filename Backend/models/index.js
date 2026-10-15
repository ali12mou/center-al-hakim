import mongoose from "mongoose";

const request = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 254 },
    phone: { type: String, required: true, maxlength: 30 },
    kind: {
      type: String,
      enum: ["registration", "enterprise", "contact"],
      required: true,
    },
    courseId: { type: String, maxlength: 80 },
    schedule: { type: String, enum: ["matin", "soir", "week-end", "flexible"] },
    message: { type: String, required: true, maxlength: 2000 },
    consent: { type: Boolean, required: true },
    consentVersion: { type: String, default: "2026-10-13" },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
  },
  { timestamps: true },
);
request.index({ createdAt: -1, status: 1 });

const course = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    department: {
      type: String,
      required: true,
      enum: ["langues", "management", "informatique", "finance"],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    topics: [String],
    level: String,
    duration: String,
    format: String,
    image: String,
    tag: String,
    phase: String,
    featured: Boolean,
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Request = mongoose.model("Request", request);
export const Course = mongoose.model("Course", course);
