import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { AdminUser } from "../models/platform.models.js";
import { setupSchema } from "../validators/admin.validator.js";
import { hashPassword } from "../services/password.service.js";

// Le JSON contenant le mot de passe entre par stdin : aucun secret dans les arguments.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { password, ...data } = setupSchema.parse(JSON.parse(input));
try {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alhakimcenter",
  );
  await AdminUser.init();
  await AdminUser.create({
    ...data,
    passwordHash: await hashPassword(password),
    bootstrap: !(await AdminUser.exists({ role: "admin" })),
  });
  console.log(`Administrateur créé : ${data.username}.`);
} finally {
  await mongoose.disconnect();
}
