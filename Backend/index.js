import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

mongoose.set("bufferCommands", false);
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(
      "MongoDB connecté. Les demandes de préinscription sont disponibles.",
    );
  } catch {
    console.error(
      "MongoDB inaccessible. Le catalogue reste disponible ; les demandes peuvent être préparées pour WhatsApp.",
    );
  }
} else {
  console.log(
    "MONGODB_URI non configuré. Catalogue disponible, enregistrement des demandes désactivé.",
  );
}
const port = Number(process.env.PORT) || 4100;
const server = createApp().listen(port, (error) => {
  if (error) {
    console.error(
      `Impossible de démarrer l’API sur le port ${port} : ${error.code}`,
    );
    process.exit(1);
  }
  console.log(`AL-HAKIM CENTER API : http://127.0.0.1:${port}`);
});
async function shutdown() {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
