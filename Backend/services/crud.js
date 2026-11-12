import mongoose from "mongoose";
import { z } from "zod";
import { can } from "../config/permissions.js";

export const httpError = (status, message) =>
  Object.assign(new Error(message), { status, expose: true });
export const actor = (req) => ({ id: req.admin._id, name: req.admin.name });
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const validId = (value) => mongoose.isValidObjectId(value);

// Messages de validation en français, avec le libellé du champ.
const frenchErrors = (issue, context) => {
  if (issue.code === "invalid_type" && issue.received === "undefined")
    return { message: "obligatoire" };
  if (issue.code === "too_small")
    return {
      message:
        issue.type === "string"
          ? issue.minimum <= 1
            ? "obligatoire"
            : `au moins ${issue.minimum} caractères`
          : issue.type === "array"
            ? `au moins ${issue.minimum} élément(s)`
            : `minimum ${issue.minimum}`,
    };
  if (issue.code === "too_big")
    return {
      message:
        issue.type === "string" ? `au plus ${issue.maximum} caractères` : `maximum ${issue.maximum}`,
    };
  if (issue.code === "invalid_enum_value") return { message: "choix non valide" };
  if (issue.code === "invalid_string")
    return { message: issue.validation === "email" ? "adresse e-mail non valide" : "format non valide" };
  return { message: context.defaultError === "Required" ? "obligatoire" : "valeur non valide" };
};
export function parseBody(schema, body, labels = {}) {
  const parsed = schema.safeParse(body, { errorMap: frenchErrors });
  if (parsed.success) return parsed.data;
  throw httpError(
    400,
    parsed.error.issues
      .slice(0, 4)
      .map((issue) => {
        const key = issue.path.join(".");
        const label = labels[issue.path[0]] || key;
        return label ? `${label} : ${issue.message}` : issue.message;
      })
      .join(" · "),
  );
}

export function sendError(error, res, next) {
  if (error.expose) return res.status(error.status).json({ error: error.message });
  next(error);
}

// Routes REST d’une ressource : GET liste, GET /:id, POST, PATCH /:id, DELETE /:id.
// `section(req, record)` renvoie la section de permission (voir config/permissions.js).
export function crudRoutes(router, config) {
  const {
    path,
    model,
    schema,
    labels = {},
    search = [],
    filters = {},
    dateField,
    sort = { createdAt: -1 },
    populate = [],
    prepare = async (data) => data,
    after = async () => {},
    beforeDelete = async () => {},
    remove,
    serialize = (item) => item,
    readOnly = [],
    only = ["list", "detail", "create", "update", "delete"],
  } = config;
  const sectionOf =
    typeof config.section === "function" ? config.section : () => config.section;
  const allowed = (req, action, record) => {
    const section = sectionOf(req, record);
    if (!section || !can(req.admin, section, action))
      throw httpError(
        403,
        "Votre compte n’a pas l’autorisation d’effectuer cette action. Demandez-la à l’administrateur général.",
      );
  };
  const withPopulate = (query) =>
    populate.reduce((current, [field, select]) => current.populate(field, select), query);
  const load = async (req) => {
    if (!validId(req.params.id)) throw httpError(400, "Identifiant invalide.");
    const record = await model.findById(req.params.id);
    if (!record) throw httpError(404, "Enregistrement introuvable.");
    return record;
  };

  if (only.includes("list"))
    router.get(path, async (req, res, next) => {
      try {
        allowed(req, "view");
        const all = req.query.all === "1";
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = all
          ? 2000
          : Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
        const filter = {};
        const q = typeof req.query.q === "string" ? req.query.q.slice(0, 100).trim() : "";
        if (q && search.length)
          filter.$or = search.map((field) => ({
            [field]: { $regex: escapeRegex(q), $options: "i" },
          }));
        for (const [key, apply] of Object.entries(filters)) {
          const value = req.query[key];
          if (typeof value === "string" && value) Object.assign(filter, apply(value.slice(0, 100), req));
        }
        if (dateField) {
          const range = {};
          if (/^\d{4}-\d{2}(-\d{2})?$/.test(req.query.from || "")) range.$gte = req.query.from;
          if (/^\d{4}-\d{2}(-\d{2})?$/.test(req.query.to || "")) range.$lte = `${req.query.to}~`;
          if (Object.keys(range).length) filter[dateField] = range;
        }
        const [items, total] = await Promise.all([
          withPopulate(model.find(filter))
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          model.countDocuments(filter),
        ]);
        res.json({
          items: await Promise.all(items.map((item) => serialize(item, req))),
          total,
          page,
          pages: Math.ceil(total / limit),
        });
      } catch (error) {
        sendError(error, res, next);
      }
    });

  if (only.includes("detail"))
    router.get(`${path}/:id`, async (req, res, next) => {
      try {
        const record = await load(req);
        allowed(req, "view", record);
        const item = await withPopulate(model.findById(record._id)).lean();
        res.json({ item: await serialize(item, req) });
      } catch (error) {
        sendError(error, res, next);
      }
    });

  if (only.includes("create"))
    router.post(path, async (req, res, next) => {
      try {
        allowed(req, "create", req.body);
        const data = await prepare(parseBody(schema, req.body, labels), { req });
        const record = await model.create(data);
        await after(record, { req, action: "create" });
        res.status(201).json({ item: await serialize(record.toObject(), req) });
      } catch (error) {
        sendError(error, res, next);
      }
    });

  if (only.includes("update"))
    router.patch(`${path}/:id`, async (req, res, next) => {
      try {
        const record = await load(req);
        allowed(req, "update", record);
        const body = { ...req.body };
        for (const key of readOnly) delete body[key];
        const data = await prepare(parseBody(schema.partial(), body, labels), {
          req,
          record,
        });
        record.set(data);
        await record.save();
        await after(record, { req, action: "update" });
        res.json({ item: await serialize(record.toObject(), req) });
      } catch (error) {
        sendError(error, res, next);
      }
    });

  if (only.includes("delete"))
    router.delete(`${path}/:id`, async (req, res, next) => {
      try {
        const record = await load(req);
        allowed(req, "delete", record);
        if (remove) return res.json(await remove(record, req));
        await beforeDelete(record, req);
        await record.deleteOne();
        await after(record, { req, action: "delete" });
        res.json({ message: "Élément supprimé." });
      } catch (error) {
        sendError(error, res, next);
      }
    });
}

// Briques de validation communes.
export const v = {
  text: (max = 200) => z.string().trim().max(max).default(""),
  required: (max = 200) => z.string().trim().min(1).max(max),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  optionalDay: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  optionalTime: z
    .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  money: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  positive: z.coerce.number().int().min(1).max(1_000_000_000),
  id: z.string().refine(validId, "identifiant non valide"),
  optionalId: z
    .union([z.string().refine(validId), z.literal(""), z.null()])
    .optional()
    .transform((value) => value || undefined),
  lines: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  url: z
    .string()
    .max(1000)
    .default("")
    .refine(
      (value) => !value || /^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value),
      "lien non valide",
    ),
};
