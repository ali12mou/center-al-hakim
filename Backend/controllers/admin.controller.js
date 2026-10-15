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
// hasOwn : « constructor » ou « __proto__ » ne doivent jamais désigner un modèle.
const modelFor = (models, name) =>
  Object.hasOwn(models, name) ? models[name] : null;
const validId = (id) => mongoose.isValidObjectId(id);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const safePerson = (record) => {
  const result = record.toObject ? record.toObject() : record;
  delete result.passwordHash;
  return result;
};

const monthKey = (date) => date.toISOString().slice(0, 7);
export async function dashboard(req, res, next) {
  try {
    const now = new Date();
    // Les 12 derniers mois, mois courant inclus (UTC, comme l’agrégation).
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );
    const [
      registrations,
      contacts,
      courses,
      published,
      unread,
      attempts,
      newRegistrations,
      recent,
      pendingContacts,
      perCourse,
      perStatus,
      monthly,
    ] = await Promise.all([
      Registration.countDocuments(),
      Contact.countDocuments(),
      Course.countDocuments(),
      Course.countDocuments({ published: true }),
      Contact.countDocuments({ status: "new" }),
      AssessmentAttempt.countDocuments(),
      Registration.countDocuments({ status: "new" }),
      Registration.find().sort({ createdAt: -1 }).limit(6).lean(),
      Contact.find({ status: "new" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email message courseId createdAt")
        .lean(),
      Registration.aggregate([
        { $group: { _id: "$courseId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      Registration.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Registration.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    const catalogue = await Course.find().select("id title").lean();
    const courseTitle = (id) =>
      catalogue.find((course) => course.id === id)?.title || id || "Non précisé";
    const months = Array.from({ length: 12 }, (_, index) => {
      const key = monthKey(
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)),
      );
      return {
        month: key,
        count: monthly.find((item) => item._id === key)?.count || 0,
      };
    });
    res.json({
      counts: {
        registrations,
        contacts,
        courses,
        published,
        unread,
        attempts,
        newRegistrations,
        thisMonth: months[11].count,
        lastMonth: months[10].count,
      },
      recent: recent.map((item) => ({
        ...safePerson(item),
        courseTitle: courseTitle(item.courseId),
      })),
      pendingContacts,
      perCourse: perCourse.map((item) => ({
        ...item,
        title: courseTitle(item._id),
      })),
      perStatus: ["new", "contacted", "confirmed", "closed"].map((status) => ({
        status,
        count: perStatus.find((item) => item._id === status)?.count || 0,
      })),
      monthly: months,
    });
  } catch (error) {
    next(error);
  }
}
export async function badges(req, res, next) {
  try {
    const [contacts, registrations] = await Promise.all([
      Contact.countDocuments({ status: "new" }),
      Registration.countDocuments({ status: "new" }),
    ]);
    res.json({ contacts, registrations });
  } catch (error) {
    next(error);
  }
}
export async function listResource(req, res, next) {
  try {
    const model = modelFor(allModels, req.params.resource);
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
    const model = modelFor(allModels, resource);
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
    const model = modelFor(resourceModels, req.params.resource);
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
