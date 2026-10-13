import { spawn } from "node:child_process";
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
const children = [
  spawn(process.execPath, ["--watch", "index.js"], {
    cwd: backend,
    stdio: "inherit",
  }),
  spawn(process.execPath, [vite, "--host", "127.0.0.1"], {
    cwd: frontend,
    stdio: "inherit",
    env: {
      ...process.env,
      API_PROXY_TARGET: `http://127.0.0.1:${process.env.PORT || 4100}`,
    },
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 150).unref();
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
