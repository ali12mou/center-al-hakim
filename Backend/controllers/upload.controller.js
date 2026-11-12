import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const UPLOAD_DIR = fileURLToPath(new URL("../uploads/", import.meta.url));
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
// Vidéos : uniquement pour le diaporama de l’accueil.
export const VIDEO_TYPES = ["video/mp4", "video/webm"];
export const UPLOAD_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];
export const MAX_UPLOAD = 10 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD = 60 * 1024 * 1024;

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
// MP4 : boîte « ftyp » suivie d’une marque lue par les navigateurs (pas HEIC ni QuickTime).
const mp4Brands = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "];
const videoSignatures = [
  [
    "mp4",
    (b) =>
      b.toString("ascii", 4, 8) === "ftyp" &&
      mp4Brands.includes(b.toString("ascii", 8, 12)),
  ],
  ["webm", (b) => b.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"))],
];
export const videoExtension = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.length > 12
    ? videoSignatures.find(([, test]) => test(buffer))?.[0] || null
    : null;

export async function uploadImage(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      return res.status(400).json({
        error:
          "Choisissez une image PNG, JPG, WebP ou GIF (10 Mo maximum) ou une vidéo MP4 ou WebM (60 Mo maximum).",
      });
    const image = imageExtension(req.body);
    const extension = image || videoExtension(req.body);
    if (!extension)
      return res.status(415).json({
        error:
          "Format non accepté. Utilisez une image PNG, JPG, WebP ou GIF, ou une vidéo MP4 ou WebM.",
      });
    if (image && req.body.length > MAX_UPLOAD)
      return res.status(413).json({ error: "Image trop lourde : 10 Mo maximum." });
    await mkdir(UPLOAD_DIR, { recursive: true });
    // Nom aléatoire : aucun nom de fichier fourni par le navigateur n’atteint le disque.
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(UPLOAD_DIR, name), req.body, { flag: "wx" });
    res.status(201).json({ url: `/uploads/${name}`, size: req.body.length });
  } catch (error) {
    next(error);
  }
}

// Documents RH et justificatifs financiers : jamais servis par /uploads (public),
// seulement par l’API, à un compte connecté ayant accès aux RH ou aux finances.
export const PRIVATE_DIR = fileURLToPath(new URL("../private-files/", import.meta.url));
export const FILE_TYPES = [...IMAGE_TYPES, "application/pdf"];
const isPdf = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.length > 8 && buffer.toString("ascii", 0, 5) === "%PDF-";
export const documentExtension = (buffer) =>
  isPdf(buffer) ? "pdf" : imageExtension(buffer);
const FILE_NAME = /^[0-9a-f-]{36}\.(pdf|png|jpg|gif|webp)$/;

export async function uploadPrivateFile(req, res, next) {
  try {
    const extension = documentExtension(req.body);
    if (!extension)
      return res.status(415).json({
        error: "Format non accepté. Utilisez un PDF ou une image PNG, JPG, WebP ou GIF.",
      });
    if (req.body.length > MAX_UPLOAD)
      return res.status(413).json({ error: "Fichier trop lourd : 10 Mo maximum." });
    await mkdir(PRIVATE_DIR, { recursive: true });
    const name = `${randomUUID()}.${extension}`;
    await writeFile(path.join(PRIVATE_DIR, name), req.body, { flag: "wx" });
    res.status(201).json({ url: `/api/admin/files/${name}`, size: req.body.length });
  } catch (error) {
    next(error);
  }
}
export function sendPrivateFile(req, res) {
  if (!FILE_NAME.test(req.params.name))
    return res.status(404).json({ error: "Document introuvable." });
  const pdf = req.params.name.endsWith(".pdf");
  res.set({
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    // Un PDF est téléchargé (la visionneuse du navigateur refuse le mode « sandbox »).
    "Content-Disposition": pdf ? `attachment; filename="document-${req.params.name}"` : "inline",
  });
  res.sendFile(req.params.name, { root: PRIVATE_DIR, dotfiles: "deny" }, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: "Document introuvable." });
  });
}
