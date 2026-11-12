import { PAY_TYPES, PAYMENT_METHODS, SHIFTS, STAFF_STATUS } from "../../lib/format.js";

const options = (map) => Object.entries(map);
export const staffLabel = (item) =>
  `${item.fullName} · ${item.reference}${item.kind === "teacher" ? " · Enseignant" : " · Employé"}`;
export const staffField = (key = "staffId", label = "Personne", extra = {}) => ({
  key,
  label,
  type: "lookup",
  lookup: "staff",
  query: "active=1",
  optionLabel: staffLabel,
  required: true,
  ...extra,
});
export const shiftField = {
  key: "shift",
  label: "Créneau",
  type: "select",
  options: options(SHIFTS),
};
export const payFields = [
  { type: "heading", label: "Rémunération", hint: "Utilisée par le calcul de la paie." },
  { key: "payType", label: "Type de rémunération", type: "select", options: options(PAY_TYPES) },
  { key: "monthlySalary", label: "Salaire mensuel", type: "money", show: (values) => values.payType === "monthly" },
  { key: "hourlyRate", label: "Tarif horaire", type: "money", show: (values) => values.payType === "hourly" },
  { key: "flatAmount", label: "Montant forfaitaire (par mois)", type: "money", show: (values) => values.payType === "flat" },
  { key: "paymentMethod", label: "Moyen de versement", type: "select", options: options(PAYMENT_METHODS) },
  { key: "paymentAccount", label: "Compte ou numéro", placeholder: "N° de compte, téléphone D-Money…" },
];
export function staffFields(kind, canRates) {
  const teacher = kind === "teacher";
  return [
    { type: "heading", label: "Identité" },
    { key: "firstName", label: "Prénom", required: true },
    { key: "lastName", label: "Nom", required: true },
    { key: "gender", label: "Sexe", type: "select", options: [["", "Non précisé"], ["F", "Femme"], ["M", "Homme"]] },
    { key: "birthDate", label: "Date de naissance", type: "date" },
    { key: "nationalId", label: "N° de pièce d’identité" },
    { key: "status", label: "Statut", type: "select", options: options(STAFF_STATUS) },
    { type: "heading", label: "Coordonnées" },
    { key: "phone", label: "Téléphone", type: "tel" },
    { key: "email", label: "E-mail", type: "email" },
    { key: "address", label: "Adresse", wide: true },
    { key: "emergencyContact", label: "Personne à prévenir", wide: true, placeholder: "Nom et téléphone" },
    { type: "heading", label: teacher ? "Enseignement" : "Poste" },
    { key: "position", label: "Poste", placeholder: teacher ? "Enseignant d’anglais" : "Secrétaire, comptable, agent d’entretien…" },
    { key: "department", label: "Service / département" },
    { key: "specialty", label: teacher ? "Spécialité" : "Compétences" },
    { key: "hireDate", label: "Date d’entrée", type: "date" },
    ...(teacher
      ? [
          { key: "subjects", label: "Langues ou matières enseignées (une par ligne)", type: "lines" },
          { key: "classes", label: "Classes attribuées (une par ligne)", type: "lines" },
          { key: "availability", label: "Disponibilités", wide: true, placeholder: "Ex. : dimanche–jeudi matin, samedi après-midi" },
        ]
      : []),
    ...(canRates ? payFields : []),
    { type: "heading", label: "Notes" },
    { key: "notes", label: "Notes internes", type: "textarea" },
  ];
}
