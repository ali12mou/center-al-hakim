import { CalendarPlus, CheckCheck, Undo2 } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { PersonCell, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi } from "../../services/adminApi.js";
import { ATTENDANCE_STATUS, SHIFTS, dayLabel, hours, today } from "../../lib/format.js";
import { staffField } from "./fields.js";

const options = (map) => Object.entries(map);

export default function AttendancePage() {
  const admin = useAdmin();
  const approver = admin.can("rh.attendance", "approve");
  const validate = (ids, ctx, validated = true) =>
    ctx.run(
      () => adminApi("/rh/attendance/validate", { method: "POST", body: { ids, validated } }),
      validated ? `${ids.length} présence(s) validée(s) : elles comptent pour la paie.` : `${ids.length} validation(s) retirée(s).`,
    );
  return (
    <ListPage
      kicker="RESSOURCES HUMAINES · ORGANISATION"
      title="Présences et heures travaillées"
      description="Pointez les présences du matin, de l’après-midi et du soir, les retards, les absences et les remplacements. Seules les heures validées par un responsable entrent dans la paie."
      endpoint="/rh/attendance"
      section="rh.attendance"
      search={false}
      exportName="presences"
      createLabel="Saisir une présence"
      pageSize={50}
      filters={[
        { key: "from", label: "Du", type: "date", default: today() },
        { key: "to", label: "au", type: "date", default: today() },
        { key: "validated", label: "Validation", options: [["", "Validées ou non"], ["false", "À valider"], ["true", "Validées"]] },
        { key: "status", label: "Statut", options: [["", "Tous les statuts"], ...options(ATTENDANCE_STATUS)] },
      ]}
      headerActions={(ctx) =>
        admin.can("rh.attendance", "create") && (
          <button
            className="button button-outline"
            onClick={() => {
              const date = ctx.filters.from || today();
              ctx.run(
                () => adminApi("/rh/attendance/from-planning", { method: "POST", body: { date } }),
                `Présences du ${dayLabel(date)} préparées depuis le planning : vérifiez, corrigez puis validez.`,
              );
            }}
          >
            <CalendarPlus size={16} /> Préparer depuis le planning
          </button>
        )
      }
      selectable={
        approver && {
          actions: [
            { label: "Valider", icon: CheckCheck, onClick: (ids, ctx) => validate(ids, ctx) },
            { label: "Retirer la validation", icon: Undo2, onClick: (ids, ctx) => validate(ids, ctx, false) },
          ],
        }
      }
      editable={(item) => !item.validated || approver}
      deletable={(item) => !item.validated || approver}
      columns={[
        { label: "Date", render: (item) => <span className="nowrap">{dayLabel(item.date)}</span>, csv: (item) => item.date },
        { label: "Personne", render: (item) => <PersonCell name={item.staffId?.fullName} detail={item.staffId?.reference} />, csv: (item) => item.staffId?.fullName },
        {
          label: "Créneau",
          render: (item) => (
            <>
              {SHIFTS[item.shift]}
              {item.startTime && <small className="cell-note">{item.startTime}–{item.endTime}</small>}
            </>
          ),
          csv: (item) => `${SHIFTS[item.shift]} ${item.startTime || ""}-${item.endTime || ""}`,
        },
        { label: "Classe / poste", render: (item) => item.classLabel || "—", csv: (item) => item.classLabel },
        { label: "Heures", align: "right", render: (item) => hours(item.hours), csv: (item) => item.hours },
        {
          label: "Statut",
          render: (item) => (
            <>
              <StatusPill
                status={{ present: "confirmed", late: "partial", absent: "overdue", excused: "pending", leave: "upcoming" }[item.status]}
                label={ATTENDANCE_STATUS[item.status]}
              />
              {item.status === "late" && item.lateMinutes > 0 && <small className="cell-note">{item.lateMinutes} min de retard</small>}
              {item.replacementStaffId && <small className="cell-note">Remplacé par {item.replacementStaffId.fullName}</small>}
            </>
          ),
          csv: (item) => ATTENDANCE_STATUS[item.status],
        },
        {
          label: "Validation",
          render: (item) =>
            item.validated ? (
              <StatusPill status="validated" label={`Validé${item.validatedBy?.name ? ` · ${item.validatedBy.name}` : ""}`} />
            ) : (
              <StatusPill status="pending" label="À valider" />
            ),
          csv: (item) => (item.validated ? "Validé" : "À valider"),
        },
      ]}
      form={{
        title: "présence",
        fields: [
          staffField(),
          { key: "date", label: "Date", type: "date", required: true, default: today },
          { key: "shift", label: "Créneau", type: "select", options: options(SHIFTS) },
          { key: "status", label: "Statut", type: "select", options: options(ATTENDANCE_STATUS) },
          { key: "startTime", label: "Arrivée", type: "time" },
          { key: "endTime", label: "Départ", type: "time" },
          {
            key: "hours",
            label: "Heures (facultatif)",
            type: "number",
            step: 0.25,
            min: 0,
            hint: "Calculées depuis l’arrivée et le départ si vous laissez vide.",
            show: (values) => ["present", "late"].includes(values.status),
          },
          { key: "lateMinutes", label: "Minutes de retard", type: "number", min: 0, show: (values) => values.status === "late" },
          { key: "classLabel", label: "Classe ou poste", placeholder: "Ex. : Anglais A1 – groupe 2" },
          staffField("replacementStaffId", "Remplaçant", {
            required: false,
            placeholder: "— Aucun —",
            show: (values) => ["absent", "excused", "leave"].includes(values.status),
          }),
          { key: "notes", label: "Notes", type: "textarea" },
        ],
      }}
    />
  );
}
