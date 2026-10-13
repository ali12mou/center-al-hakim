import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(
  new URL("../../Frondend/public/fonts/", import.meta.url),
);
mkdirSync(directory, { recursive: true });
for (const [family, file, range] of [
  ["DM Sans", "dm-sans", "400..700"],
  ["Manrope", "manrope", "400..800"],
]) {
  const response = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(" ", "+")}:wght@${range}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
    },
  );
  if (!response.ok) throw new Error(`Police inaccessible : ${family}`);
  const stylesheet = await response.text();
  const source = [
    ...stylesheet.matchAll(
      /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g,
    ),
  ].at(-1)?.[1];
  if (!source) throw new Error(`Format WOFF2 absent : ${family}`);
  const font = await fetch(source);
  if (!font.ok) throw new Error(`Téléchargement impossible : ${family}`);
  writeFileSync(
    `${directory}/${file}.woff2`,
    Buffer.from(await font.arrayBuffer()),
  );
  console.log(`Police locale : ${file}.woff2`);
}
