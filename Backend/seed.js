import dotenv from "dotenv";
import mongoose from "mongoose";
import { courses } from "./data/catalogue.js";
import { Course } from "./models/index.js";
import { fileURLToPath } from "node:url";
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

if (!process.env.MONGODB_URI)
  throw new Error(
    "Définissez MONGODB_URI dans .env avant de lancer le chargement du catalogue.",
  );
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await Course.bulkWrite(
    courses.map((course) => ({
      updateOne: {
        filter: { id: course.id },
        update: { $set: course },
        upsert: true,
      },
    })),
  );
  console.log(`${courses.length} formations enregistrées dans MongoDB.`);
} finally {
  await mongoose.disconnect();
}
