import { useState } from "react";
import { Download } from "lucide-react";
import { ColumnChart } from "../../components/Charts.jsx";
import { Alert, PageHeading, Panel, PeriodPicker, PersonCell, SimpleTable, StatGrid, StatusPill } from "../../components/ui.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { STAFF_STATUS, downloadCsv, hours, money, monthLabel, shortMonthLabel, thisMonth } from "../../lib/format.js";

export default function HrReportsPage() {
  const [period, setPeriod] = useState({ from: thisMonth(), to: thisMonth() });
  const [kind, setKind] = useState("");
  const { data, error } = useRemote(`/rh/reports?from=${period.from}&to=${period.to}`, { delay: 200 });
  const rows = (data?.rows || []).filter((row) => !kind || row.kind === kind);
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const exportRows = () =>
    downloadCsv(
      `rapport-rh-${period.from}-${period.to}`,
      rows.map((row) => ({
        Matricule: row.reference,
        Nom: row.fullName,
        Type: row.kind === "teacher" ? "Enseignant" : "Employé",
        Statut: STAFF_STATUS[row.status],
        "Heures validées": row.hours,
        "Heures à valider": row.pendingHours,
        Séances: row.sessions,
        Retards: row.lates,
        "Minutes de retard": row.lateMinutes,
        Absences: row.absences,
        "Jours de congé": row.leaveDays,
        "Net à payer": row.net,
        Versé: row.paid,
      })),
    );
  return (
    <>
      <PageHeading
        kicker="RESSOURCES HUMAINES · ANALYSE"
        title="Rapports RH"
        description="Heures, retards, absences, congés et paie par personne sur la période choisie."
      >
        <PeriodPicker type="month" {...period} onChange={setPeriod} />
        <button className="button button-outline" onClick={exportRows} disabled={!rows.length}>
          <Download size={16} /> Exporter (CSV)
        </button>
      </PageHeading>
      <Alert error={error} />
      <StatGrid
        loading={!data}
        className="money-stats"
        items={[
          { label: "Heures validées", value: hours(sum("hours")), note: `${hours(sum("pendingHours"))} encore à valider` },
          { label: "Retards", value: sum("lates"), note: `${sum("lateMinutes")} minutes au total`, tone: "pink" },
          { label: "Absences et congés", value: sum("absences"), note: `${sum("leaveDays")} jour(s) de congé approuvés`, tone: "blue" },
          { label: "Masse salariale nette", value: money(sum("net")), note: `${money(sum("paid"))} versés`, tone: "green" },
        ]}
      />
      <Panel title="Masse salariale par mois" subtitle="Net des bulletins de la période">
        {data?.monthly.length ? (
          <ColumnChart
            label="Masse salariale nette par mois"
            format={money}
            items={data.monthly.map((row) => ({ key: row.month, label: shortMonthLabel(row.month), title: monthLabel(row.month), value: row.net }))}
          />
        ) : (
          <p className="dashboard-zero">Aucun bulletin sur cette période.</p>
        )}
      </Panel>
      <Panel
        title="Détail par personne"
        action={
          <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Type de personnel">
            <option value="">Tout le personnel</option>
            <option value="teacher">Enseignants</option>
            <option value="employee">Employés</option>
          </select>
        }
      >
        <SimpleTable
          rows={rows}
          columns={[
            { label: "Personne", render: (row) => <PersonCell name={row.fullName} detail={`${row.reference} · ${row.kind === "teacher" ? "Enseignant" : "Employé"}`} /> },
            { label: "Statut", render: (row) => <StatusPill status={row.status} label={STAFF_STATUS[row.status]} /> },
            { label: "Heures validées", align: "right", render: (row) => hours(row.hours) },
            { label: "Séances", align: "right", render: (row) => row.sessions },
            { label: "Retards", align: "right", render: (row) => (row.lates ? `${row.lates} (${row.lateMinutes} min)` : "0") },
            { label: "Absences", align: "right", render: (row) => row.absences },
            { label: "Congés (j)", align: "right", render: (row) => row.leaveDays },
            { label: "Net", align: "right", render: (row) => money(row.net) },
            { label: "Versé", align: "right", render: (row) => money(row.paid) },
          ]}
        />
      </Panel>
    </>
  );
}
