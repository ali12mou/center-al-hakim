import { spawn } from "node:child_process";
import { statSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import dotenv from "dotenv";
import "./export-public-data.js";

// Un seul npm run dev démarre l’API et React, avec rechargement automatique.
const require = createRequire(import.meta.url);
const backend = fileURLToPath(new URL("../", import.meta.url));
const frontend = fileURLToPath(new URL("../../Frondend/", import.meta.url));
dotenv.config({ path: path.join(backend, ".env") });
const vite = path.join(
  path.dirname(require.resolve("vite/package.json")),
  "bin/vite.js",
);
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 150).unref();
}
function run(args, options) {
  const child = spawn(process.execPath, args, { stdio: "inherit", ...options });
  children.add(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping && !child.restarting) stop(code || 0);
  });
  return child;
}

// Pas de node --watch : sous Windows, la simple lecture d’un fichier (date de
// dernier accès) relançait l’API et coupait les requêtes en cours, dont la
// connexion à l’administration. L’API ne redémarre que si un fichier source a
// réellement été modifié depuis son lancement.
let api;
let apiStartedAt = 0;
let restartTimer;
function startApi() {
  apiStartedAt = Date.now();
  api = run(["index.js"], { cwd: backend });
}
function restartApi() {
  if (stopping || api.restarting) return;
  console.log("Fichier modifié : redémarrage de l’API…");
  api.restarting = true;
  api.once("exit", startApi);
  api.kill();
}
startApi();
watch(backend, { recursive: true }, (_event, file) => {
  if (!file || !/\.(js|json)$/.test(file)) return;
  if (/^(node_modules|uploads)[\\/]/.test(file)) return;
  let modifiedAt = Infinity; // fichier supprimé ou renommé
  try {
    modifiedAt = statSync(path.join(backend, file)).mtimeMs;
  } catch {}
  if (modifiedAt < apiStartedAt) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(restartApi, 200);
});

run([vite, "--host", "127.0.0.1"], {
  cwd: frontend,
  env: {
    ...process.env,
    API_PROXY_TARGET: `http://127.0.0.1:${process.env.PORT || 4100}`,
  },
});
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
