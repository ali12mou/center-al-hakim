import { Printer } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import { useRemote } from "../hooks/useRemote.js";
import { dayLabel, hours, money, monthLabel, PAY_TYPES, PAYMENT_METHODS, STATUS } from "../lib/format.js";

// Montant en toutes lettres, pour les reçus (« quarante-huit mille »).
const units = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
function below100(n) {
  if (n < 17) return units[n];
  if (n < 20) return `dix-${units[n - 10]}`;
  const ten = Math.floor(n / 10);
  let unit = n % 10;
  if (ten === 7 || ten === 9) unit += 10;
  const base = tens[ten];
  if (unit === 0) return ten === 8 ? "quatre-vingts" : base;
  if (unit === 1 && ten < 8) return `${base} et un`;
  if (unit === 11 && ten === 7) return `${base} et onze`;
  return `${base}-${below100(unit)}`;
}
function below1000(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundred === 0 ? "" : hundred === 1 ? "cent" : `${units[hundred]} cent${rest === 0 ? "s" : ""}`;
  return [head, rest ? below100(rest) : ""].filter(Boolean).join(" ");
}
export function amountInWords(value) {
  let n = Math.round(Math.abs(value || 0));
  if (n === 0) return "zéro";
  const parts = [];
  for (const [size, singular, plural] of [
    [1e9, "milliard", "milliards"],
    [1e6, "million", "millions"],
  ]) {
    const count = Math.floor(n / size);
    if (count) parts.push(`${below1000(count)} ${count > 1 ? plural : singular}`);
    n %= size;
  }
  const thousands = Math.floor(n / 1000);
  // « mille » est invariable et fige « cent » et « vingt » devant lui.
  if (thousands)
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands).replace(/cents$/, "cent").replace(/vingts$/, "vingt")} mille`);
  n %= 1000;
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

function Header({ issuer, title, number, date }) {
  return (
    <header className="doc-header">
      <div className="doc-brand">
        <img src="/Untitled-2.png" alt="" />
        <div>
          <strong>{issuer?.centreName || "AL-HAKIM CENTER"}</strong>
          <small>{[issuer?.centreAddress, issuer?.centrePhone, issuer?.centreEmail].filter(Boolean).join(" · ")}</small>
          {issuer?.taxId && <small>NIF : {issuer.taxId}</small>}
        </div>
      </div>
      <div className="doc-title">
        <h3>{title}</h3>
        <strong>{number}</strong>
        {date && <small>{date}</small>}
      </div>
    </header>
  );
}

function Receipt({ item, issuer, currency }) {
  const account = item.studentAccountId || {};
  return (
    <>
      <Header issuer={issuer} title="Reçu de paiement" number={item.receiptNumber} date={`Le ${dayLabel(item.date)}`} />
      {item.status === "cancelled" && <p className="doc-cancelled">REÇU ANNULÉ — {item.cancelReason}</p>}
      <dl className="doc-facts">
        <div><dt>Reçu de</dt><dd>{item.studentName}</dd></div>
        <div><dt>Dossier</dt><dd>{account.reference || "—"}</dd></div>
        <div><dt>Formation</dt><dd>{account.courseTitle || "—"}</dd></div>
        <div><dt>Facture</dt><dd>{item.invoiceId?.number || "—"}</dd></div>
      </dl>
      <table className="doc-table">
        <thead><tr><th>Moyen de paiement</th><th>Compte</th><th>Référence</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {item.splits.map((split, index) => (
            <tr key={index}>
              <td>{PAYMENT_METHODS[split.method]}</td>
              <td>{split.accountId?.name || "—"}</td>
              <td>{split.transactionRef || "—"}</td>
              <td className="num">{money(split.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={3}>Total reçu</th><th className="num">{money(item.amount, currency)}</th></tr></tfoot>
      </table>
      <p className="doc-words">Arrêté le présent reçu à la somme de <b>{amountInWords(item.amount)} {currency === "FDJ" ? "francs Djibouti" : currency}</b>.</p>
      {account.totalAmount !== undefined && (
        <dl className="doc-facts doc-totals">
          <div><dt>Montant de la formation</dt><dd>{money(account.totalAmount, currency)}</dd></div>
          <div><dt>Total payé à ce jour</dt><dd>{money(account.paidAmount, currency)}</dd></div>
          <div><dt>Reste à payer</dt><dd>{money(Math.max(0, account.totalAmount - account.paidAmount), currency)}</dd></div>
        </dl>
      )}
      <footer className="doc-footer">
        <span>Encaissé par : {item.recordedBy?.name || "—"}</span>
        <span className="doc-sign">Signature et cachet</span>
      </footer>
    </>
  );
}

function Invoice({ item, issuer, currency }) {
  const account = item.studentAccountId || {};
  return (
    <>
      <Header issuer={issuer} title="Facture" number={item.number} date={`Émise le ${dayLabel(item.issueDate)}`} />
      {item.status === "cancelled" && <p className="doc-cancelled">FACTURE ANNULÉE — {item.cancelReason}</p>}
      <div className="doc-parties">
        <div>
          <small>Facturé à</small>
          <strong>{item.billTo?.name}</strong>
          {item.billTo?.address && <span>{item.billTo.address}</span>}
          {item.billTo?.contact && <span>{item.billTo.contact}</span>}
          {item.billTo?.kind === "organisation" && account.studentName && <span>Student : {account.studentName}</span>}
        </div>
        <div>
          <small>Dossier</small>
          <strong>{account.reference || "—"}</strong>
          <span>Échéance : {dayLabel(item.dueDate)}</span>
        </div>
      </div>
      <table className="doc-table">
        <thead><tr><th>Désignation</th><th className="num">Qté</th><th className="num">Prix unitaire</th><th className="num">Montant</th></tr></thead>
        <tbody>
          {item.lines.map((line, index) => (
            <tr key={index}>
              <td>{line.label}</td>
              <td className="num">{line.quantity}</td>
              <td className="num">{money(line.unitPrice, currency)}</td>
              <td className="num">{money(line.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th colSpan={3}>Sous-total</th><th className="num">{money(item.subtotal, currency)}</th></tr>
          {item.discount > 0 && <tr><th colSpan={3}>Remise</th><th className="num">− {money(item.discount, currency)}</th></tr>}
          <tr className="doc-grand"><th colSpan={3}>Total à payer</th><th className="num">{money(item.total, currency)}</th></tr>
          {item.paid !== undefined && <tr><th colSpan={3}>Déjà payé</th><th className="num">{money(item.paid, currency)}</th></tr>}
          {item.paid !== undefined && <tr><th colSpan={3}>Solde</th><th className="num">{money(Math.max(0, item.total - item.paid), currency)}</th></tr>}
        </tfoot>
      </table>
      <p className="doc-words">Arrêtée la présente facture à la somme de <b>{amountInWords(item.total)} {currency === "FDJ" ? "francs Djibouti" : currency}</b>.</p>
      <footer className="doc-footer">
        <span>{issuer?.invoiceFooter}</span>
        <span className="doc-sign">La direction</span>
      </footer>
    </>
  );
}

function Payslip({ item, issuer, currency }) {
  const staff = item.staffId || {};
  const earnings = item.lines.filter((line) => ["base", "bonus"].includes(line.kind));
  const deductions = item.lines.filter((line) => !["base", "bonus"].includes(line.kind));
  return (
    <>
      <Header issuer={issuer} title="Bulletin de paie" number={item.reference} date={monthLabel(item.period)} />
      {item.status === "draft" && <p className="doc-cancelled">BROUILLON — non validé</p>}
      <dl className="doc-facts">
        <div><dt>Nom</dt><dd>{item.staff.name}</dd></div>
        <div><dt>Matricule</dt><dd>{item.staff.reference}</dd></div>
        <div><dt>Fonction</dt><dd>{item.staff.position || (item.staff.kind === "teacher" ? "Enseignant" : "Employé")}</dd></div>
        <div><dt>Rémunération</dt><dd>{PAY_TYPES[item.payType]}</dd></div>
        {item.payType === "hourly" && <div><dt>Heures validées</dt><dd>{hours(item.hours)} × {money(item.hourlyRate, currency)}</dd></div>}
        {staff.paymentMethod && <div><dt>Versement</dt><dd>{PAYMENT_METHODS[staff.paymentMethod]} {staff.paymentAccount}</dd></div>}
      </dl>
      <table className="doc-table">
        <thead><tr><th>Élément</th><th className="num">Gains</th><th className="num">Retenues</th></tr></thead>
        <tbody>
          {earnings.map((line, index) => (
            <tr key={`e${index}`}><td>{line.label}</td><td className="num">{money(line.amount, currency)}</td><td /></tr>
          ))}
          {deductions.map((line, index) => (
            <tr key={`d${index}`}><td>{line.label}</td><td /><td className="num">{money(line.amount, currency)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th>Totaux</th><th className="num">{money(item.gross, currency)}</th><th className="num">{money(item.totalDeductions, currency)}</th></tr>
          <tr className="doc-grand"><th colSpan={2}>Net à payer</th><th className="num">{money(item.net, currency)}</th></tr>
          {item.paidAmount > 0 && <tr><th colSpan={2}>Déjà versé</th><th className="num">{money(item.paidAmount, currency)}</th></tr>}
        </tfoot>
      </table>
      <p className="doc-words">Net à payer : <b>{amountInWords(item.net)} {currency === "FDJ" ? "francs Djibouti" : currency}</b>.</p>
      <footer className="doc-footer">
        <span>{item.validatedBy?.name ? `Validé par ${item.validatedBy.name}` : STATUS[item.status]?.[0]}</span>
        <span className="doc-sign">Signature de l’employé</span>
      </footer>
    </>
  );
}

const DOCUMENTS = { receipt: Receipt, invoice: Invoice, payslip: Payslip };
export default function PrintDocument({ kind, item, onClose }) {
  const { data: issuer } = useRemote("/lookups/issuer");
  const Document = DOCUMENTS[kind];
  const currency = issuer?.currency || "FDJ";
  return (
    <Dialog title="Aperçu avant impression" onClose={onClose} className="admin-editor print-dialog">
      <div className="print-actions no-print">
        <p>Utilisez « Imprimer » puis choisissez « Enregistrer au format PDF » pour obtenir le fichier.</p>
        <button className="button" onClick={() => window.print()}>
          <Printer size={16} /> Imprimer / PDF
        </button>
      </div>
      <article className="print-doc">
        <Document item={item} issuer={issuer} currency={currency} />
      </article>
    </Dialog>
  );
}
