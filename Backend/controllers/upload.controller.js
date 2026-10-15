import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const UPLOAD_DIR = fileURLToPath(new URL("../uploads/", import.meta.url));
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_UPLOAD = 5 * 1024 * 1024;

// Le format est déduit des premiers octets, jamais du nom ni du Content-Type envoyé.
// Le SVG est volontairement exclu : il peut contenir du script.
const signatures = [
  ["png", (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))],
  ["jpg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["gif", (b) => ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6))],
  [
    "webp",
    (b) =>
      b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  ],
];
export const imageExtension = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.length > 12
    ? signatures.find(([, test]) => test(buffer))?.[0] || null
    : null;

export async function uploadImage(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      return res.status(400).json({
        error: "Choisissez une image PNG, JPG, WebP ou GIF de 5 Mo maximum.",
      });
    const extension = imageExtension(req.body);
    if (!extension)
      return res.status(415).json({
        error: "Format non accepté. Utilisez une image PNG, JPG, WebP ou GIF.",
      });
    await mkdir(UPLOAD_DIR, { recursive: true });
    // Nom aléatoire : aucun nom de fichier fourni par le navigateur n’atteint le disque.
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, name), req.body, { flag: "wx" });
    res.status(201).json({ url: `/uploads/${name}`, size: req.body.length });
  } catch (error) {
    next(error);
  }
}
