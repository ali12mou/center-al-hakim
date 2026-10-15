import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { platformModels } from "../models/platform.models.js";
import { Course, Request } from "../models/index.js";
import { seedPlatform } from "../services/platform.service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
try {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alhakimcenter",
    { serverSelectionTimeoutMS: 5000 },
  );
  await Promise.all(
    [...platformModels, Course, Request].map((model) => model.init()),
  );
  await seedPlatform();
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(
    JSON.stringify({
      database: mongoose.connection.name,
      collections: collections.map((item) => item.name).sort(),
    }),
  );
} finally {
  await mongoose.disconnect();
}
