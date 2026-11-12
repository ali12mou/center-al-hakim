// Montants, dates métier et libellés partagés par les modules RH et finances.
const number = new Intl.NumberFormat("fr-FR");
export const money = (value, currency = "FDJ") =>
  `${number.format(Math.round(value || 0))} ${currency}`;
// Pour les axes : 1 200 → « 1,2 k », 1 500 000 → « 1,5 M ».
export const compact = (value) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
export const dayLabel = (value) =>
  value ? dayFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : "—";
export const longDayLabel = (value) =>
  value ? longDay.format(new Date(`${value}T00:00:00Z`)) : "—";
export const monthLabel = (value) => {
  if (!value) return "—";
  const label = monthFormat.format(new Date(`${value}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
export const shortMonthLabel = (value) =>
  shortMonth.format(new Date(`${value}-01T00:00:00Z`)).replace(".", "");

const djibouti = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Djibouti",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const today = () => djibouti.format(new Date());
export const thisMonth = () => today().slice(0, 7);
export function shiftMonth(month, count) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + count, 1)).toISOString().slice(0, 7);
}
export const monthStart = (month = thisMonth()) => `${month}-01`;
export function monthEnd(month = thisMonth()) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
}
export const hours = (value) => `${String(Math.round((value || 0) * 100) / 100).replace(".", ",")} h`;

export const PAYMENT_METHODS = {
  cash: "Espèces",
  bank: "Virement / banque",
  dmoney: "D-Money",
  waafi: "Waafi",
  cacpay: "CAC Pay",
  sabapay: "Saba Pay",
};
export const ACCOUNT_KINDS = {
  cash: "Espèces",
  bank: "Comptes bancaires",
  dmoney: "D-Money",
  waafi: "Waafi",
  cacpay: "CAC Pay",
  sabapay: "Saba Pay",
};
export const PAY_TYPES = {
  monthly: "Salaire mensuel",
  hourly: "Paiement à l’heure",
  flat: "Montant forfaitaire",
};
export const SHIFTS = {
  matin: "Matin",
  "apres-midi": "Après-midi",
  soir: "Soir / nuit",
  journee: "Journée",
};
export const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const LEAVE_TYPES = {
  annual: "Congé annuel",
  sick: "Congé maladie",
  unpaid: "Congé sans solde",
  exceptional: "Congé exceptionnel",
  maternity: "Congé maternité",
  absence_justified: "Absence justifiée",
  absence_unjustified: "Absence non justifiée",
};
export const STAFF_STATUS = { active: "Actif", inactive: "Suspendu", left: "Parti" };
export const CONTRACT_TYPES = {
  cdi: "CDI",
  cdd: "CDD",
  vacation: "Vacation (enseignant)",
  prestation: "Prestation",
  stage: "Stage",
};
export const DOCUMENT_KINDS = {
  identite: "Pièce d’identité",
  cv: "CV",
  diplome: "Diplôme",
  contrat: "Contrat signé",
  attestation: "Attestation",
  autre: "Autre",
};
export const ATTENDANCE_STATUS = {
  present: "Présent",
  late: "En retard",
  absent: "Absent",
  excused: "Absence excusée",
  leave: "En congé",
};
export const ADJUSTMENT_TYPES = { bonus: "Prime", deduction: "Retenue", advance: "Avance" };
export const PLANS = {
  full: "Paiement intégral",
  monthly: "Paiement mensuel",
  installments: "Échelonnement (3, 4 ou 5 mois)",
  custom: "Échéancier personnalisé",
};

// Statut → [libellé, ton]. Le ton choisit la pastille : la couleur n’est jamais seule.
export const STATUS = {
  pending: ["En attente", "new"],
  approved: ["Validé", "confirmed"],
  validated: ["Validé", "confirmed"],
  rejected: ["Refusé", "closed"],
  cancelled: ["Annulé", "closed"],
  draft: ["Brouillon", "new"],
  partial: ["Partiellement payé", "contacted"],
  paid: ["Payé", "confirmed"],
  unpaid: ["Non payé", "new"],
  overdue: ["En retard", "overdue"],
  upcoming: ["À venir", "contacted"],
  confirmed: ["Confirmé", "confirmed"],
  active: ["Actif", "confirmed"],
  completed: ["Soldé", "confirmed"],
  issued: ["Émise", "contacted"],
  planned: ["Prévu", "contacted"],
  done: ["Effectué", "confirmed"],
  replaced: ["Remplacé", "new"],
  ended: ["Terminé", "closed"],
  terminated: ["Rompu", "closed"],
  inactive: ["Suspendu", "new"],
  left: ["Parti", "closed"],
};

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  // Point-virgule et BOM : Excel en français ouvre le fichier correctement.
  const csv = [headers, ...rows.map((row) => headers.map((key) => row[key]))]
    .map((line) => line.map(cell).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${filename}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
