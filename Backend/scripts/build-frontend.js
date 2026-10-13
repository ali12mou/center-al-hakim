import { fileURLToPath } from "node:url";
import { build } from "vite";
import { cpSync } from "node:fs";
import "./export-public-data.js";

await build({
  root: fileURLToPath(new URL("../../Frondend/", import.meta.url)),
});
// L’hébergeur Sites attend un répertoire dist à la racine.
// Le code et le build React restent aussi dans Frondend.
cpSync(
  fileURLToPath(new URL("../../Frondend/dist/", import.meta.url)),
  fileURLToPath(new URL("../../dist/", import.meta.url)),
  { recursive: true },
);
