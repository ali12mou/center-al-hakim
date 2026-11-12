import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleDollarSign, Download, MessageCircle } from "lucide-react";
import { Alert, Forbidden, PageHeading, Panel, PersonCell, SimpleTable, StatGrid, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { dayLabel, downloadCsv, money } from "../../lib/format.js";

// Rappel WhatsApp prérempli (le message part depuis le téléphone de l’agent).
const reminder = (item) => {
  const phone = (item.phone || "").replace(/[^\d]/g, "");
  const text = `Bonjour ${item.studentName}, AL-HAKIM CENTER vous rappelle qu’un montant de ${money(item.overdueAmount || item.nextDue?.amount)} reste à régler pour votre formation${item.courseTitle ? ` « ${item.courseTitle} »` : ""}. Merci.`;
  return phone ? `https://wa.me/${phone.startsWith("253") ? phone : `253${phone}`}?text=${encodeURIComponent(text)}` : null;
};

export default function ReceivablesPage() {
  const admin = useAdmin();
  const [tab, setTab] = useState("overdue");
  const allowed = admin.can("finance.schedules");
  const { data, error } = useRemote(allowed ? `/finance/receivables?status=${tab === "overdue" ? "overdue" : "all"}` : null);
  if (!allowed) return <Forbidden />;
  const items = data?.items || [];
  return (
    <>
      <PageHeading
        kicker="FINANCES · PAIEMENTS DES STUDENTS"
        title="Mensualités et impayés"
        description="Les échéances dépassées et les soldes restant dus, du plus gros retard au plus petit."
      >
        <button
          className="button button-outline"
          disabled={!items.length}
          onClick={() =>
            downloadCsv(
              `impayes-${tab}`,
              items.map((item) => ({
                Dossier: item.reference,
                Student: item.studentName,
                Téléphone: item.phone,
                Formation: item.courseTitle,
                "En retard": item.overdueAmount,
                "Échéances en retard": item.overdueCount,
                "Reste dû": item.balance,
                "Prochaine échéance": item.nextDue?.dueDate || "",
              })),
            )
          }
        >
          <Download size={16} /> Exporter (CSV)
        </button>
        {admin.can("finance.payments", "create") && (
          <Link to="/admin/finance/encaisser" className="button">
            <CircleDollarSign size={16} /> Encaisser un paiement
          </Link>
        )}
      </PageHeading>
      <Alert error={error} />
      <StatGrid
        loading={!data}
        className="money-stats"
        items={
          data
            ? [
                { label: "Montant en retard", value: money(data.totals.overdue), note: tab === "overdue" ? `${data.totals.accounts} dossier(s) en retard` : "Échéances dépassées", tone: "pink" },
                { label: "Reste dû total", value: money(data.totals.balance), note: `${data.totals.accounts} dossier(s)` },
              ]
            : []
        }
      />
      <Tabs value={tab} onChange={setTab} tabs={[["overdue", "Impayés (échéances dépassées)"], ["all", "Tous les soldes restant dus"]]} />
      <Panel>
        <SimpleTable
          rows={items}
          empty={<p className="dashboard-zero">{tab === "overdue" ? "Aucun impayé : toutes les échéances passées sont réglées." : "Aucun solde restant dû."}</p>}
          columns={[
            { label: "Student", render: (row) => <PersonCell name={row.studentName} detail={`${row.reference} · ${row.phone || "sans téléphone"}`} /> },
            { label: "Formation", render: (row) => row.courseTitle || "—" },
            { label: "En retard", align: "right", render: (row) => (row.overdueAmount ? <b>{money(row.overdueAmount)}</b> : "—") },
            { label: "Échéances en retard", align: "right", render: (row) => row.overdueCount },
            { label: "Reste dû", align: "right", render: (row) => money(row.balance) },
            { label: "Prochaine échéance", render: (row) => (row.nextDue ? `${dayLabel(row.nextDue.dueDate)} · ${money(row.nextDue.amount)}` : "—") },
            { label: "Statut", render: (row) => <StatusPill status={row.paymentStatus} /> },
            {
              label: "Relance",
              render: (row) =>
                reminder(row) && (
                  <a className="panel-action" href={reminder(row)} target="_blank" rel="noreferrer">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
