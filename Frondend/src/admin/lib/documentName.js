export function documentName(kind, item, date = new Date()) {
  const label = { invoice: "Facture", receipt: "Recu", payslip: "Bulletin_de_paie" }[kind] || "Document";
  const person = kind === "payslip"
    ? item.staffId?.name
    : kind === "invoice"
      ? item.billTo?.name || item.studentAccountId?.studentName || item.studentName
      : item.studentName || item.studentAccountId?.studentName;
  const name = String(person || "Sans_nom")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .trim().replace(/[\s.]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "Sans_nom";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Djibouti", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${label}_${name}_${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
}
