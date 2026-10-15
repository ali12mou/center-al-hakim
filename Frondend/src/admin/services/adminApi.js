const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let csrfToken = "";
export function setAdminCsrf(value) {
  csrfToken = value || "";
}

export async function adminApi(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}/api/admin${path}`, {
    method,
    credentials: "include",
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "L’administration nécessite le backend Node.js connecté à MongoDB. Ouvrez le serveur local ou configurez votre API.",
    );
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data.error || "Cette action n’a pas pu être effectuée.",
    );
    error.status = response.status;
    error.smtpUnavailable = data.smtpUnavailable;
    throw error;
  }
  return data;
}
