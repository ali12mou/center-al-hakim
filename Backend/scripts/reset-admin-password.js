import dotenv from "dotenv";
import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { AdminUser, AdminSession } from "../models/platform.models.js";
import { hashPassword } from "../services/password.service.js";
import { audit, clearLoginFailures } from "../services/security.service.js";
import { passwordProblem } from "../validators/password-policy.js";

// Génère un mot de passe temporaire, ferme toutes les sessions du compte et
// impose un nouveau mot de passe à la prochaine connexion.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
const username = (process.argv[2] || "").trim().toLowerCase();
if (!username) {
  console.error("Usage : npm run admin:reset -- <nom_utilisateur>");
  process.exit(1);
}
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const group = () =>
  Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
let password;
do password = [group(), group(), group(), group()].join("-");
while (passwordProblem(password, { username }));

try {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alhakimcenter",
    { serverSelectionTimeoutMS: 5000 },
  );
  const user = await AdminUser.findOne({ username });
  if (!user) {
    console.error(`Aucun administrateur avec l’identifiant « ${username} ».`);
    process.exitCode = 1;
  } else {
    user.passwordHash = await hashPassword(password);
    user.mustChangePassword = true;
    user.passwordChangedAt = new Date();
    await user.save();
    await AdminSession.deleteMany({ userId: user._id });
    await clearLoginFailures(username);
    await audit("password_reset", null, { user });
    console.log(`Mot de passe temporaire pour « ${username} » : ${password}`);
    console.log(
      "Il ne sert qu’une fois : un nouveau mot de passe sera demandé à la connexion.",
    );
  }
} finally {
  await mongoose.disconnect();
}
