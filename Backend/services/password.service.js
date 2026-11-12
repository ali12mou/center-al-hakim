import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { passwordProblem } from "../validators/password-policy.js";

// Mot de passe à usage unique, lisible au téléphone : « Abcd-Efgh-Jkmn-Pqrs ».
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const group = () =>
  Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
export function temporaryPassword(username = "") {
  let password;
  do password = [group(), group(), group(), group()].join("-");
  while (passwordProblem(password, { username }));
  return password;
}

const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = (encoded || "").split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = await scrypt(password, salt, 64);
  const stored = Buffer.from(expected, "hex");
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
