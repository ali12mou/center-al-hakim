import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { courses, departments, centre } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";
import {
  getPublicPortal,
  getStaticPortal,
} from "../services/platform.service.js";
import { Course } from "../models/index.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
// Ce snapshot contient exclusivement les publications publiques, jamais les inscrits,
// les contacts, les identifiants, les sessions ou les réponses aux évaluations.
export async function exportPublicData() {
  let catalogue = courses;
  let portal = getStaticPortal();
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
      });
      catalogue = await Course.find({ published: { $ne: false } })
        .select("-_id -__v")
        .lean();
      portal = await getPublicPortal();
    } catch {
      console.log("Export public : utilisation du contenu de présentation.");
    } finally {
      await mongoose.disconnect();
    }
  }
  const directory = fileURLToPath(
    new URL("../../Frondend/public/", import.meta.url),
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    `${directory}/catalogue.json`,
    JSON.stringify({
      courses: catalogue,
      departments,
      centre,
      content: siteContent,
      portal,
    }),
  );
}
await exportPublicData();
