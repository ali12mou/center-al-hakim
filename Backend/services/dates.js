// Dates métier au format « AAAA-MM-JJ », calculées à l’heure de Djibouti.
const djibouti = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Djibouti",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const today = (date = new Date()) => djibouti.format(date);
export const currentMonth = (date = new Date()) => today(date).slice(0, 7);

const parse = (value) => new Date(`${value}T00:00:00Z`);
const format = (date) => date.toISOString().slice(0, 10);
// 0 = dimanche … 6 = samedi.
export const weekday = (value) => parse(value).getUTCDay();
export function addDays(value, days) {
  const date = parse(value);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}
export function addMonths(month, count) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}
// Même jour du mois suivant, ramené au dernier jour si besoin (31 → 30).
export function addMonthsToDay(value, count) {
  const [year, index, dayOfMonth] = value.split("-").map(Number);
  const last = new Date(Date.UTC(year, index - 1 + count + 1, 0)).getUTCDate();
  return format(
    new Date(Date.UTC(year, index - 1 + count, Math.min(dayOfMonth, last))),
  );
}
export function monthDays(month) {
  const [year, index] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, offset) => `${month}-${String(offset + 1).padStart(2, "0")}`,
  );
}
export function daysBetween(start, end) {
  return Math.round((parse(end) - parse(start)) / 86_400_000) + 1;
}
const minutes = (value) => {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
};
// « 08:00 » → « 10:30 » = 2,5 h ; une fin avant le début passe minuit.
export function hoursBetween(start, end) {
  if (!start || !end) return 0;
  let diff = minutes(end) - minutes(start);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}
export const lateMinutes = (planned, actual) =>
  planned && actual ? Math.max(0, minutes(actual) - minutes(planned)) : 0;
export const isDay = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export const isMonth = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
