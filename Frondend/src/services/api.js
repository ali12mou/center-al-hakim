// L’interface ne possède pas les données métier : elle les demande au Backend.
const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
import { translatePublicData } from '../../../Backend/data/languages.js';
import { trackLoading } from "./loading.js";

async function get(path) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new Error("API indisponible");
  return response.json();
}

export const getSiteData = (language = "fr") =>
  trackLoading(loadSiteData(language));

async function loadSiteData(language) {
  try {
    const [catalogue, centreData, content, health, portal] = await Promise.all([
      get("/courses"),
      get("/centre"),
      get("/content"),
      get("/health"),
      get("/pages"),
    ]);
    return translatePublicData({
      ...catalogue,
      ...centreData,
      content,
      registrationsAvailable: health.registrationsAvailable,
      portal,
    }, language);
  } catch {
    // L’aperçu hébergé utilise un export PUBLIC créé par le Backend au build.
    // Il ne simule jamais un enregistrement dans MongoDB.
    const response = await fetch("/catalogue.json");
    if (!response.ok)
      throw new Error("Impossible de charger le site. Veuillez réessayer.");
    return translatePublicData({ ...(await response.json()), registrationsAvailable: false }, language);
  }
}

export async function submitAssessment(id, data) {
  const response = await fetch(`${baseUrl}/api/assessments/${id}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "L’évaluation ne peut pas être enregistrée.",
    );
  return result;
}

export async function sendRequest(data) {
  const response = await fetch(`${baseUrl}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Votre demande n’a pas pu être envoyée.");
  return result;
}
