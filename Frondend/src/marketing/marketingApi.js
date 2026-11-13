// Client de l’API du portail marketing : uniquement /api/marketing.
const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let csrfToken = "";
export function setMarketingCsrf(value) {
  csrfToken = value || "";
}
const listeners = new Set();
export function onMarketingAuthEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const OFFLINE = "Connexion impossible. Vérifiez votre accès à Internet puis réessayez.";

export async function marketingApi(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}/api/marketing${path}`, {
    method,
    credentials: "include",
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(() => null);
  if (!response?.headers.get("content-type")?.includes("application/json"))
    throw Object.assign(new Error(OFFLINE), { offline: true });
  const data = await response.json();
  if (!response.ok) {
    const error = Object.assign(new Error(data.error || "Action impossible pour le moment."), {
      status: response.status,
    });
    if (response.status === 401 && path !== "/auth/login")
      listeners.forEach((listener) => listener({ type: "expired", message: error.message }));
    if (data.passwordChangeRequired) listeners.forEach((listener) => listener({ type: "password" }));
    throw error;
  }
  return data;
}
