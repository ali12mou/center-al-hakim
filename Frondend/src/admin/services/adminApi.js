const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let csrfToken = "";
export function setAdminCsrf(value) {
  csrfToken = value || "";
}
// Session expirée ou mot de passe temporaire : l’application réagit partout.
const listeners = new Set();
export function onAdminAuthEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_DOWN =
  "Le serveur de l’administration ne répond pas. Vérifiez que « npm run dev » tourne et que MongoDB est démarré.";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FILE_NOT_SENT =
  "Le fichier n’a pas pu être envoyé : le navigateur n’a pas réussi à le lire, ou la connexion a été coupée. S’il se trouve sur OneDrive, sur un téléphone ou s’il est encore en téléchargement, copiez-le d’abord dans un dossier de l’ordinateur (par exemple Images), puis réessayez.";

async function serverReachable() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Un import peut échouer sans que le serveur soit arrêté : fichier illisible
// (OneDrive « en ligne uniquement », téléphone…) ou connexion coupée. On vérifie
// le serveur avant de l’accuser, et on retente une fois s’il redémarrait.
async function sendFile(path, options) {
  try {
    return await send(path, options);
  } catch (error) {
    // `status` présent : le serveur a répondu (format refusé, 503…).
    if (!error.unreachable || error.status) throw error;
    if (!(await serverReachable())) {
      await wait(2000);
      if (!(await serverReachable())) throw error;
    }
    try {
      return await send(path, options);
    } catch (retryError) {
      if (!retryError.unreachable || retryError.status) throw retryError;
      throw new Error(FILE_NOT_SENT);
    }
  }
}

// Une lecture (GET) est retentée quelques secondes : le temps qu’un serveur
// qui redémarre réponde de nouveau. Les écritures ne le sont jamais, sauf
// l’import d’un fichier (voir sendFile).
export async function adminApi(path, options = {}) {
  if (options.file) return sendFile(path, options);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await send(path, options);
    } catch (error) {
      if ((options.method || "GET") !== "GET" || !error.unreachable || attempt >= 4)
        throw error;
      await wait(1500);
    }
  }
}

// `file` envoie une image brute (import) ; `body` envoie du JSON.
async function send(path, { method = "GET", body, file } = {}) {
  const response = await fetch(`${baseUrl}/api/admin${path}`, {
    method,
    credentials: "include",
    // Une vidéo de 60 Mo peut prendre plusieurs minutes sur une connexion lente.
    signal: AbortSignal.timeout(file ? 5 * 60000 : 20000),
    headers: {
      ...(file
        ? { "Content-Type": file.type }
        : body
          ? { "Content-Type": "application/json" }
          : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    ...(file ? { body: file } : body ? { body: JSON.stringify(body) } : {}),
  }).catch((error) => {
    if (error.name === "TimeoutError")
      throw new Error("Le serveur met trop de temps à répondre. Réessayez.");
    // Cause exacte visible dans la console du navigateur (F12) pour le diagnostic.
    if (file) console.warn("Import interrompu :", error);
    return null;
  });
  // Pas de réponse, ou réponse du proxy au lieu de l’API : le Backend est arrêté.
  if (!response?.headers.get("content-type")?.includes("application/json"))
    throw Object.assign(new Error(SERVER_DOWN), { unreachable: true });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.error || "Cette action n’a pas pu être effectuée.",
    );
    error.status = response.status;
    error.smtpUnavailable = data.smtpUnavailable;
    // 503 : l’API tourne mais MongoDB se connecte encore (ou est arrêté).
    error.unreachable = response.status === 503;
    if (
      response.status === 401 &&
      !["/auth/login", "/auth/setup"].includes(path)
    )
      listeners.forEach((listener) =>
        listener({ type: "expired", message: error.message }),
      );
    if (data.passwordChangeRequired)
      listeners.forEach((listener) => listener({ type: "password" }));
    throw error;
  }
  return data;
}
