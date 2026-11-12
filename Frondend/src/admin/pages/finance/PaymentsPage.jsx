import { useState } from "react";
import { Ban, Printer } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import PrintDocument from "../../components/PrintDocument.jsx";
import { PersonCell, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import { PAYMENT_METHODS, dayLabel, money, monthStart, today } from "../../lib/format.js";

// Historique des paiements des students ; sert aussi d’onglet « Reçus ».
export default function PaymentsPage({ heading = true }) {
  const admin = useAdmin();
  const [printing, setPrinting] = useState(null);
  async function print(item) {
    setPrinting((await adminApi(`/finance/payments/${item._id}`)).item);
  }
  return (
    <>
      <ListPage
        heading={heading}
        kicker="FINANCES · PAIEMENTS DES STUDENTS"
        title="Historique des paiements"
        description="Chaque règlement avec son reçu, ses moyens de paiement, sa référence de transaction et l’agent qui l’a enregistré. Une annulation conserve la trace et son motif."
        endpoint="/finance/payments"
        section="finance.payments"
        search="Student, n° de reçu, référence de transaction…"
        exportName="paiements-eleves"
        filters={[
          { key: "from", label: "Du", type: "date", default: monthStart() },
          { key: "to", label: "au", type: "date", default: today() },
          { key: "method", label: "Moyen", options: [["", "Tous les moyens"], ...Object.entries(PAYMENT_METHODS)] },
          { key: "status", label: "Statut", options: [["", "Tous les statuts"], ["confirmed", "Confirmés"], ["cancelled", "Annulés"]] },
        ]}
        deletable={() => false}
        actions={(item, ctx) => [
          { icon: Printer, label: "Imprimer le reçu", onClick: () => print(item).catch((failure) => ctx.setError(failure.message)) },
          admin.can("finance.payments", "delete") &&
            item.status === "confirmed" && {
              icon: Ban,
              label: "Annuler le paiement",
              tone: "delete",
              onClick: () => {
                const reason = window.prompt(`Motif de l’annulation du reçu ${item.receiptNumber} :`);
                if (reason)
                  ctx.run(() => adminApi(`/finance/payments/${item._id}/cancel`, { method: "POST", body: { reason } }), "Paiement annulé : le solde du dossier a été recalculé.");
              },
            },
        ]}
        columns={[
          { label: "Reçu", render: (item) => <span className="record-id">{item.receiptNumber}</span>, csv: (item) => item.receiptNumber },
          { label: "Date", render: (item) => <span className="nowrap">{dayLabel(item.date)}</span>, csv: (item) => item.date },
          { label: "Student", render: (item) => <PersonCell name={item.studentName} detail={item.studentAccountId?.courseTitle} />, csv: (item) => item.studentName },
          {
            label: "Moyens",
            render: (item) => (
              <div className="chip-list">
                {item.splits.map((split, index) => (
                  <span key={index} className="chip" title={split.transactionRef || undefined}>
                    {PAYMENT_METHODS[split.method]} {item.splits.length > 1 && money(split.amount)}
                  </span>
                ))}
              </div>
            ),
            csv: (item) => item.splits.map((split) => `${PAYMENT_METHODS[split.method]} ${split.amount} ${split.transactionRef}`).join(" + "),
          },
          { label: "Montant", align: "right", render: (item) => <b>{money(item.amount)}</b>, csv: (item) => item.amount },
          {
            label: "Justificatif",
            render: (item) =>
              item.proofUrl ? (
                <a className="doc-link" href={fileUrl(item.proofUrl)} target="_blank" rel="noreferrer">
                  Voir
                </a>
              ) : (
                "—"
              ),
          },
          {
            label: "Statut",
            render: (item) => (
              <>
                <StatusPill status={item.status} />
                <small className="cell-note">{item.status === "cancelled" ? item.cancelReason : `par ${item.recordedBy?.name || "—"}`}</small>
              </>
            ),
            csv: (item) => (item.status === "cancelled" ? `Annulé : ${item.cancelReason}` : "Confirmé"),
          },
        ]}
      />
      {printing && <PrintDocument kind="receipt" item={printing} onClose={() => setPrinting(null)} />}
    </>
  );
}
