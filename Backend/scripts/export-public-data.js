import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { courses, departments, centre } from "../data/catalogue.js";
import { siteContent } from "../data/siteContent.js";

// Aperçu statique : seules les données publiques sont exportées.
// Les demandes des visiteurs ne sont jamais incluses dans cet export.
export function exportPublicData() {
  const directory = fileURLToPath(
    new URL("../../Frondend/public/", import.meta.url),
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    `${directory}/catalogue.json`,
    JSON.stringify({ courses, departments, centre, content: siteContent }),
  );
}
exportPublicData();
