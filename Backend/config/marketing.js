// Marketing et prospection : listes partagées. Le Backend les impose,
// l’administration et le portail des agents les affichent.
export const PROSPECT_STATUS = {
  new: "Nouveau",
  interested: "Intéressé",
  following: "En cours de suivi",
  visit: "Visitera le centre",
  satisfied: "Satisfait",
  enrolled: "Inscrit",
  not_interested: "Non intéressé",
};
// Ton de la pastille (classes status-* de l’administration).
export const PROSPECT_TONE = {
  new: "new",
  interested: "contacted",
  following: "contacted",
  visit: "contacted",
  satisfied: "confirmed",
  enrolled: "confirmed",
  not_interested: "closed",
};
export const PROSPECT_SOURCES = {
  field: "Prospection terrain",
  social: "Réseaux sociaux",
  referral: "Recommandation",
  event: "Salon / événement",
  phone: "Appel entrant",
  website: "Site web",
  other: "Autre",
};
// Prospects encore « en cours » : comptés dans les relances à effectuer.
export const OPEN_STATUSES = ["new", "interested", "following", "visit", "satisfied"];
// Prospects dont l’intérêt est confirmé.
export const INTERESTED_STATUSES = ["interested", "following", "visit", "satisfied"];

// Clé de doublon : les 8 derniers chiffres du téléphone (format de Djibouti).
export const phoneKey = (phone = "") => phone.replace(/\D/g, "").slice(-8);
