import { Ban, Check, X } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { PersonCell, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import { LEAVE_TYPES, dayLabel, today } from "../../lib/format.js";
import { staffField } from "./fields.js";

const STATUS = { pending: "En attente", approved: "Approuvé", rejected: "Refusé", cancelled: "Annulé" };

export default function LeavesPage() {
  const admin = useAdmin();
  const approver = admin.can("rh.leaves", "approve");
  const decide = (item, ctx, status, message) =>
    ctx.run(() => adminApi(`/rh/leaves/${item._id}/decision`, { method: "POST", body: { status } }), message);
  return (
    <ListPage
      kicker="RESSOURCES HUMAINES · ORGANISATION"
      title="Congés et absences"
      description="Demandes de congé, absences justifiées ou non, et remplacements. Un congé approuvé annule ou réattribue les séances prévues sur la période."
      endpoint="/rh/leaves"
      section="rh.leaves"
      search={false}
      exportName="conges"
      createLabel="Nouvelle demande"
      filters={[
        { key: "status", label: "Statut", options: [["", "Toutes les demandes"], ...Object.entries(STATUS)] },
        { key: "type", label: "Type", options: [["", "Tous les types"], ...Object.entries(LEAVE_TYPES)] },
      ]}
      editable={(item) => item.status === "pending"}
      deletable={(item) => item.status !== "approved"}
      actions={(item, ctx) => [
        approver && item.status === "pending" && { icon: Check, label: "Approuver", tone: "approve", onClick: () => decide(item, ctx, "approved", "Demande approuvée. Le planning a été mis à jour.") },
        approver && item.status === "pending" && { icon: X, label: "Refuser", tone: "delete", onClick: () => decide(item, ctx, "rejected", "Demande refusée.") },
        approver && item.status === "approved" && {
          icon: Ban,
          label: "Annuler le congé",
          onClick: () => window.confirm("Annuler ce congé approuvé ?") && decide(item, ctx, "cancelled", "Congé annulé."),
        },
      ]}
      columns={[
        { label: "Personne", render: (item) => <PersonCell name={item.staffId?.fullName} detail={item.staffId?.reference} />, csv: (item) => item.staffId?.fullName },
        { label: "Type", render: (item) => LEAVE_TYPES[item.type], csv: (item) => LEAVE_TYPES[item.type] },
        { label: "Période", render: (item) => <span className="nowrap">{dayLabel(item.startDate)} → {dayLabel(item.endDate)}</span>, csv: (item) => `${item.startDate} → ${item.endDate}` },
        { label: "Jours", align: "right", render: (item) => item.days, csv: (item) => item.days },
        { label: "Remplaçant", render: (item) => item.replacementStaffId?.fullName || "—", csv: (item) => item.replacementStaffId?.fullName || "" },
        {
          label: "Motif",
          render: (item) => (
            <>
              <span className="message-excerpt" title={item.reason}>{item.reason || "—"}</span>
              {item.documentUrl && (
                <a className="doc-link" href={fileUrl(item.documentUrl)} target="_blank" rel="noreferrer">
                  Justificatif
                </a>
              )}
            </>
          ),
          csv: (item) => item.reason,
        },
        {
          label: "Statut",
          render: (item) => (
            <>
              <StatusPill status={item.status} label={STATUS[item.status]} />
              {item.decidedBy?.name && <small className="cell-note">par {item.decidedBy.name}</small>}
            </>
          ),
          csv: (item) => STATUS[item.status],
        },
      ]}
      form={{
        title: "congé ou absence",
        fields: [
          staffField(),
          { key: "type", label: "Type", type: "select", options: Object.entries(LEAVE_TYPES) },
          { key: "startDate", label: "Du", type: "date", required: true, default: today },
          { key: "endDate", label: "Au (inclus)", type: "date", required: true, default: today },
          { key: "days", label: "Nombre de jours", type: "number", min: 0, step: 0.5, hint: "Calculé automatiquement (hors week-end) si vous laissez vide." },
          staffField("replacementStaffId", "Remplaçant (facultatif)", { required: false, placeholder: "— Aucun —" }),
          { key: "reason", label: "Motif", type: "textarea" },
          { key: "documentUrl", label: "Justificatif (certificat médical…)", type: "file" },
        ],
      }}
    />
  );
}
