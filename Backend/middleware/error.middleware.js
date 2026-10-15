export function errorHandler(error, _req, res, _next) {
  if (error.code === 11000)
    return res
      .status(409)
      .json({
        error: "Cet identifiant existe déjà. Choisissez une autre valeur.",
      });
  if (error.name === "ValidationError" || error.name === "CastError")
    return res
      .status(400)
      .json({ error: "Les informations fournies ne sont pas valides." });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Le contenu JSON est invalide." });
  if (error.type === "entity.too.large")
    return res.status(413).json({ error: "La demande est trop volumineuse." });
  // Les détails de connexion et les données des visiteurs ne sont pas exposés.
  console.error("API error:", error.name);
  res.status(503).json({
    error:
      "Le service est temporairement indisponible. Votre demande n’a pas été confirmée.",
  });
}
