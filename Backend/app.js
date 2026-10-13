import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createApiRouter } from "./routes/api.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

export function createApp({ saveRequest, isDatabaseReady, loadCourses } = {}) {
  const app = express();
  app.disable("x-powered-by");
  const ready = isDatabaseReady || (() => mongoose.connection.readyState === 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  const origins = (
    process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173"
  )
    .split(",")
    .map((value) => value.trim());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Trop de requêtes. Réessayez dans une minute." },
    }),
  );
  app.use(
    "/api",
    createApiRouter({ saveRequest, loadCourses, isDatabaseReady: ready }),
  );

  // Node.js peut servir le build React et l’API sur le même domaine.
  const dist = fileURLToPath(new URL("../Frondend/dist/", import.meta.url));
  if (existsSync(path.join(dist, "index.html"))) {
    app.use(express.static(dist));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use(errorHandler);
  return app;
}
