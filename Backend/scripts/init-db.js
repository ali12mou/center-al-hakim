import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { platformModels } from "../models/platform.models.js";
import { hrModels } from "../models/hr.models.js";
import { financeModels } from "../models/finance.models.js";
import { systemModels } from "../models/system.models.js";
import { Course, Request } from "../models/index.js";
import { studentModels } from "../models/student.models.js";
import { seedPlatform } from "../services/platform.service.js";
import { seedFinance } from "../services/finance.service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
try {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alhakimcenter",
    { serverSelectionTimeoutMS: 5000 },
  );
  await Promise.all(
    [...platformModels, ...hrModels, ...financeModels, ...systemModels, ...studentModels, Course, Request].map(
      (model) => model.init(),
    ),
  );
  await seedPlatform();
  await seedFinance();
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
