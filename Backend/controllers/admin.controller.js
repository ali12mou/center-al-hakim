import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  Registration,
  Contact,
  AssessmentAttempt,
} from "../models/platform.models.js";
import { Course } from "../models/index.js";
import { resourceModels } from "../services/platform.service.js";
import { contentSchemas, personSchema } from "../validators/admin.validator.js";
import { hashPassword } from "../services/password.service.js";

const allModels = {
  ...resourceModels,
  registrations: Registration,
  contacts: Contact,
  attempts: AssessmentAttempt,
};
const validId = (id) => mongoose.isValidObjectId(id);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const safePerson = (record) => {
  const result = record.toObject ? record.toObject() : record;
  delete result.passwordHash;
  return result;
};

export async function dashboard(req, res, next) {
  try {
    const [
      registrations,
      contacts,
      courses,
      published,
      unread,
      attempts,
      recent,
      perCourse,
      monthly,
    ] = await Promise.all([
      Registration.countDocuments(),
      Contact.countDocuments(),
      Course.countDocuments(),
      Course.countDocuments({ published: true }),
      Contact.countDocuments({ status: "new" }),
      AssessmentAttempt.countDocuments(),
      Registration.find().sort({ createdAt: -1 }).limit(5).lean(),
      Registration.aggregate([
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      Registration.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
    ]);
    const catalogue = await Course.find().select("id title").lean();
    res.json({
      counts: { registrations, contacts, courses, published, unread, attempts },
      recent,
      perCourse: perCourse.map((item) => ({
        ...item,
        title:
          catalogue.find((course) => course.id === item._id)?.title ||
          item._id ||
          "Non précisé",
      })),
      monthly,
    });
  } catch (error) {
    next(error);
  }
}
export async function listResource(req, res, next) {
  try {
    const model = allModels[req.params.resource];
    if (!model) return res.status(404).json({ error: "Section introuvable." });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );
    const search =
      typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
    const fields = ["registrations", "contacts", "attempts"].includes(
      req.params.resource,
    )
      ? ["name", "email", "phone", "reference"]
      : ["title", "description"];
    const filter = search
      ? {
          $or: fields.map((field) => ({
            [field]: { $regex: escapeRegex(search), $options: "i" },
          })),
        }
      : {};
    if (
      ["registrations", "contacts"].includes(req.params.resource) &&
      typeof req.query.courseId === "string" &&
      req.query.courseId
    )
      filter.courseId = req.query.courseId.slice(0, 80);
    const [items, total] = await Promise.all([
      model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      model.countDocuments(filter),
    ]);
    const catalogue = ["registrations", "contacts"].includes(
      req.params.resource,
    )
      ? await Course.find().select("id title").lean()
      : [];
    res.json({
      items: items.map((item) => ({
        ...item,
        ...(catalogue.length
          ? {
              courseTitle:
                catalogue.find((course) => course.id === item.courseId)
                  ?.title || "Non précisé",
            }
          : {}),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}
export async function saveResource(req, res, next) {
  try {
    const resource = req.params.resource;
    const model = allModels[resource];
    if (!model || resource === "attempts")
      return res.status(404).json({ error: "Section non modifiable." });
    if (req.params.id && !validId(req.params.id))
      return res.status(400).json({ error: "Identifiant invalide." });
    const person = ["registrations", "contacts"].includes(resource);
    const schema = person ? personSchema : contentSchemas[resource];
    const parsed = (
      req.method === "PATCH" ? schema.partial() : schema
    ).safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: parsed.error.issues
            .map((issue) => `${issue.path.join(".")} : ${issue.message}`)
            .join(" · "),
        });
    const data = parsed.data;
    if (resource === "courses" && req.params.id && data.id) {
      const existing = await Course.findById(req.params.id);
      if (
        existing &&
        existing.id !== data.id &&
        (await Registration.exists({ courseId: existing.id }))
      )
        return res
          .status(409)
          .json({
            error:
              "Cette formation possède des inscriptions. Conservez son identifiant.",
          });
    }
    if (person) {
      if (data.courseId && !(await Course.exists({ id: data.courseId })))
        return res.status(400).json({ error: "Formation introuvable." });
      const { password, ...fields } = data;
      Object.assign(data, fields);
      delete data.password;
      if (password) {
        data.passwordHash = await hashPassword(password);
        data.hasPassword = true;
      }
      if (resource === "contacts") {
        delete data.passwordHash;
        delete data.hasPassword;
        delete data.username;
        delete data.profile;
      }
    }
    let record;
    if (req.params.id)
      record = await model.findByIdAndUpdate(
        req.params.id,
        { $set: data },
        { new: true, runValidators: true },
      );
    else
      record = await model.create({
        ...data,
        ...(person
          ? {
              reference: `AH-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
              consent: true,
            }
          : {}),
      });
    if (!record)
      return res.status(404).json({ error: "Enregistrement introuvable." });
    res.status(req.params.id ? 200 : 201).json({ item: safePerson(record) });
  } catch (error) {
    next(error);
  }
}
export async function deleteResource(req, res, next) {
  try {
    const model = resourceModels[req.params.resource];
    if (!model || !validId(req.params.id))
      return res
        .status(400)
        .json({ error: "Cette section ne permet pas la suppression." });
    if (req.params.resource === "courses") {
      const course = await Course.findById(req.params.id);
      if (course && (await Registration.exists({ courseId: course.id })))
        return res
          .status(409)
          .json({
            error:
              "Cette formation possède des inscriptions. Dépubliez-la pour la retirer du site.",
          });
    }
    if (!(await model.findByIdAndDelete(req.params.id)))
      return res.status(404).json({ error: "Enregistrement introuvable." });
    res.json({ message: "Publication supprimée." });
  } catch (error) {
    next(error);
  }
}
