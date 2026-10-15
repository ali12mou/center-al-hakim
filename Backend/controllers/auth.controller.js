import { randomBytes } from "node:crypto";
import { AdminUser, AdminSession } from "../models/platform.models.js";
import {
  hashPassword,
  verifyPassword,
  hashToken,
} from "../services/password.service.js";
import {
  localSetupAllowed,
  readSessionCookie,
} from "../middleware/admin.middleware.js";
import { setupSchema, loginSchema } from "../validators/admin.validator.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
});
async function startSession(user, res) {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const maxAge = 8 * 60 * 60 * 1000;
  await AdminSession.create({
    userId: user._id,
    tokenHash: hashToken(token),
    csrfToken,
    expiresAt: new Date(Date.now() + maxAge),
  });
  res.cookie("ah_admin", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge,
  });
  return { user: publicUser(user), csrfToken };
}
export async function authStatus(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    const setupRequired = (await AdminUser.countDocuments()) === 0;
    const token = readSessionCookie(req);
    const session =
      token &&
      (await AdminSession.findOne({
        tokenHash: hashToken(token),
        expiresAt: { $gt: new Date() },
      }));
    const user = session && (await AdminUser.findById(session.userId));
    res.json({
      setupRequired,
      setupAllowed: setupRequired && localSetupAllowed(req),
      user: user ? publicUser(user) : null,
      csrfToken: user ? session.csrfToken : null,
    });
  } catch (error) {
    next(error);
  }
}
export async function setupAdmin(req, res, next) {
  try {
    if (!localSetupAllowed(req))
      return res
        .status(403)
        .json({
          error:
            "La création initiale se fait uniquement depuis le serveur local. Utilisez le script de création pour la production.",
        });
    if (await AdminUser.exists({ role: "admin" }))
      return res
        .status(409)
        .json({ error: "L’administration est déjà configurée." });
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });
    const { password, ...data } = parsed.data;
    const user = await AdminUser.create({
      ...data,
      passwordHash: await hashPassword(password),
      bootstrap: true,
    });
    res.status(201).json(await startSession(user, res));
  } catch (error) {
    next(error);
  }
}
export async function loginAdmin(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Renseignez votre identifiant et votre mot de passe." });
    const user = await AdminUser.findOne({
      username: parsed.data.username.toLowerCase(),
    }).select("+passwordHash");
    if (
      !user ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    )
      return res
        .status(401)
        .json({ error: "Identifiant ou mot de passe incorrect." });
    res.json(await startSession(user, res));
  } catch (error) {
    next(error);
  }
}
export async function logoutAdmin(req, res, next) {
  try {
    await AdminSession.deleteOne({ _id: req.adminSession._id });
    res.clearCookie("ah_admin", {
      path: "/api",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ message: "Vous êtes déconnecté." });
  } catch (error) {
    next(error);
  }
}
