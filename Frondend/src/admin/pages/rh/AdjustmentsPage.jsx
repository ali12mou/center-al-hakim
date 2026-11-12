import { Ban, Check, X } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { PersonCell, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi } from "../../services/adminApi.js";
import { ADJUSTMENT_TYPES, money, monthLabel, thisMonth } from "../../lib/format.js";
import { staffField } from "./fields.js";

const STATUS = { pending: "En attente", approved: "Accordé", rejected: "Refusé", cancelled: "Annulé" };

export default function AdjustmentsPage() {
  const admin = useAdmin();
  const approver = admin.can("rh.adjustments", "approve");
  const decide = (item, ctx, status, message) =>
    ctx.run(() => adminApi(`/rh/adjustments/${item._id}/decision`, { method: "POST", body: { status } }), message);
  return (
    <ListPage
      kicker="RESSOURCES HUMAINES · PAIE"
      title="Primes, avances et retenues"
      description="Une prime ou une retenue s’applique au bulletin du mois choisi. Une avance, une fois accordée puis versée par les finances, est retenue sur les salaires suivants (par exemple sur 2 mois)."
      endpoint="/rh/adjustments"
      section="rh.adjustments"
      search={false}
      exportName="primes-avances-retenues"
      createLabel="Nouvel élément"
      filters={[
        { key: "type", label: "Type", options: [["", "Primes, avances et retenues"], ...Object.entries(ADJUSTMENT_TYPES)] },
        { key: "status", label: "Statut", options: [["", "Tous les statuts"], ...Object.entries(STATUS)] },
        { key: "period", label: "Mois", type: "month" },
      ]}
      editable={(item) => item.status === "pending"}
      deletable={(item) => item.status !== "approved"}
      actions={(item, ctx) => [
        approver && item.status === "pending" && { icon: Check, label: "Accorder", tone: "approve", onClick: () => decide(item, ctx, "approved", "Élément accordé : il sera pris en compte dans la paie.") },
        approver && item.status === "pending" && { icon: X, label: "Refuser", tone: "delete", onClick: () => decide(item, ctx, "rejected", "Élément refusé.") },
        approver && item.status === "approved" && !item.disbursed?.paid && {
          icon: Ban,
          label: "Annuler",
          onClick: () => window.confirm("Annuler cet élément accordé ?") && decide(item, ctx, "cancelled", "Élément annulé."),
        },
      ]}
      columns={[
        { label: "Personne", render: (item) => <PersonCell name={item.staffId?.fullName} detail={item.staffId?.reference} />, csv: (item) => item.staffId?.fullName },
        {
          label: "Type",
          render: (item) => (
            <>
              <span className={`chip chip-${item.type}`}>{ADJUSTMENT_TYPES[item.type]}</span>
              {item.label && <small className="cell-note">{item.label}</small>}
            </>
          ),
          csv: (item) => `${ADJUSTMENT_TYPES[item.type]} ${item.label}`,
        },
        { label: "Montant", align: "right", render: (item) => money(item.amount), csv: (item) => item.amount },
        {
          label: "Application",
          render: (item) =>
            item.type === "advance"
              ? `Retenue sur ${item.repaymentMonths} mois dès ${monthLabel(item.repaymentStart || item.period).toLowerCase()}`
              : monthLabel(item.period),
          csv: (item) => item.repaymentStart || item.period,
        },
        {
          label: "Statut",
          render: (item) => (
            <>
              <StatusPill status={item.status} label={STATUS[item.status]} />
              {item.type === "advance" && item.status === "approved" && (
                <small className="cell-note">{item.disbursed?.paid ? "Versée par les finances" : "À verser par les finances"}</small>
              )}
            </>
          ),
          csv: (item) => STATUS[item.status],
        },
      ]}
      createDefaults={{ type: "bonus", period: thisMonth(), repaymentMonths: 2 }}
      form={{
        title: "prime, avance ou retenue",
        fields: [
          staffField(),
          { key: "type", label: "Type", type: "select", options: Object.entries(ADJUSTMENT_TYPES) },
          { key: "label", label: "Description", placeholder: "Ex. : Prime de fin d’année, Retenue pour retard" },
          { key: "amount", label: "Montant", type: "money", required: true },
          { key: "period", label: "Mois concerné", type: "month", required: true, hint: (values) => (values.type === "advance" ? "Mois où l’avance est accordée." : "Bulletin sur lequel l’élément apparaît.") },
          { key: "repaymentMonths", label: "Rembourser sur (mois)", type: "number", min: 1, maxValue: 12, show: (values) => values.type === "advance" },
          { key: "repaymentStart", label: "Première retenue", type: "month", show: (values) => values.type === "advance", hint: "Par défaut : le mois de l’avance." },
          { key: "notes", label: "Justification", type: "textarea" },
        ],
      }}
    />
  );
}
