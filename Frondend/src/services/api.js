// L’interface ne possède pas les données métier : elle les demande au Backend.
const baseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

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

export async function getSiteData() {
  try {
    const [catalogue, centreData, content, health] = await Promise.all([
      get("/courses"),
      get("/centre"),
      get("/content"),
      get("/health"),
    ]);
    return {
      ...catalogue,
      ...centreData,
      content,
      registrationsAvailable: health.registrationsAvailable,
    };
  } catch {
    // L’aperçu hébergé utilise un export PUBLIC créé par le Backend au build.
    // Il ne simule jamais un enregistrement dans MongoDB.
    const response = await fetch("/catalogue.json");
    if (!response.ok)
      throw new Error("Impossible de charger le site. Veuillez réessayer.");
    return { ...(await response.json()), registrationsAvailable: false };
  }
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
