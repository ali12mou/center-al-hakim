import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarCheck, CalendarX, GraduationCap, UserRound, Wallet } from "lucide-react";
import { HBars } from "../../components/Charts.jsx";
import { Alert, PageHeading, Panel, PersonCell, SimpleTable, StatGrid } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { LEAVE_TYPES, SHIFTS, dayLabel, hours, longDayLabel, money, monthLabel, today } from "../../lib/format.js";

export default function HrDashboard() {
  const admin = useAdmin();
  const { data, error } = useRemote("/rh/dashboard");
  const counts = data?.counts;
  const present = (data?.attendanceToday.present || 0) + (data?.attendanceToday.late || 0);
  const day = longDayLabel(today());
  return (
    <>
      <PageHeading
        kicker="RESSOURCES HUMAINES"
        title="Tableau de bord RH"
        description={`${day.charAt(0).toUpperCase() + day.slice(1)} · enseignants, employés, présences, congés et paie.`}
      >
        {admin.can("rh.attendance", "create") && (
          <Link to="/admin/rh/presences" className="button button-outline">
            <CalendarCheck size={17} /> Pointer les présences
          </Link>
        )}
        {admin.can("rh.payroll") && (
          <Link to="/admin/rh/paie" className="button">
            <Wallet size={17} /> Paie du mois
          </Link>
        )}
      </PageHeading>
      <Alert error={error} />
      <StatGrid
        loading={!data}
        items={
          data
            ? [
                { icon: GraduationCap, label: "Enseignants actifs", value: counts.teachers, note: "Temps partiel et à l’heure", to: admin.can("rh.teachers") ? "/admin/rh/enseignants" : undefined },
                { icon: UserRound, label: "Employés actifs", value: counts.employees, note: `${counts.inactive} suspendu(s)`, tone: "blue", to: admin.can("rh.employees") ? "/admin/rh/employes" : undefined },
                { icon: CalendarCheck, label: "Présents aujourd’hui", value: present, note: `${data.attendanceToday.absent || 0} absent(s) · ${counts.toValidate} présence(s) à valider`, tone: "green", to: admin.can("rh.attendance") ? "/admin/rh/presences" : undefined },
                { icon: CalendarX, label: "Congés à valider", value: counts.pendingLeaves, note: `${counts.onLeave} en congé aujourd’hui · ${counts.lates} retard(s) ce mois`, tone: "pink", to: admin.can("rh.leaves") ? "/admin/rh/conges" : undefined },
              ]
            : []
        }
      />
      <div className="dashboard-grid dashboard-grid-wide">
        <Panel
          title="Planning d’aujourd’hui"
          subtitle={data ? `${data.planningToday.length} séance(s) ou créneau(x)` : ""}
          action={admin.can("rh.planning") && <Link to="/admin/rh/planning">Planning <ArrowUpRight size={15} /></Link>}
        >
          <SimpleTable
            rows={data?.planningToday}
            empty={<p className="dashboard-zero">Aucune séance prévue aujourd’hui.</p>}
            columns={[
              { label: "Horaire", render: (row) => <span className="nowrap">{row.startTime}–{row.endTime}</span> },
              { label: "Personne", render: (row) => <PersonCell name={row.staffId?.fullName} detail={SHIFTS[row.shift]} /> },
              { label: "Classe / poste", render: (row) => <>{row.label}{row.room && <small className="cell-note">Salle {row.room}</small>}</> },
            ]}
          />
        </Panel>
        <Panel title={`Paie de ${monthLabel(data?.month).toLowerCase()}`} subtitle="Bulletins du mois en cours">
          {data && (
            <dl className="mini-facts">
              <div><dt>Net à payer</dt><dd>{money(data.payroll.net)}</dd></div>
              <div><dt>Déjà versé</dt><dd>{money(data.payroll.paid)}</dd></div>
              <div><dt>Bulletins</dt><dd>{data.payroll.count}</dd></div>
              <div><dt>Brouillons à valider</dt><dd>{data.payroll.drafts}</dd></div>
            </dl>
          )}
          <h3 className="panel-subtitle">Heures du mois par personne</h3>
          <HBars
            items={(data?.hoursByStaff || []).map((row) => ({ key: row.staffId, label: row.name, value: row.hours }))}
            format={hours}
            empty="Les heures pointées ce mois-ci apparaîtront ici."
          />
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Demandes de congé en attente" action={admin.can("rh.leaves") && <Link to="/admin/rh/conges">Traiter <ArrowUpRight size={15} /></Link>}>
          <SimpleTable
            rows={data?.pendingLeaves}
            empty={<p className="dashboard-zero">Aucune demande en attente.</p>}
            columns={[
              { label: "Personne", render: (row) => <PersonCell name={row.staffId?.fullName} detail={LEAVE_TYPES[row.type]} /> },
              { label: "Période", render: (row) => `${dayLabel(row.startDate)} → ${dayLabel(row.endDate)}` },
              { label: "Jours", align: "right", render: (row) => row.days },
            ]}
          />
        </Panel>
        <Panel title="Absents et contrats à surveiller">
          <SimpleTable
            rows={[
              ...(data?.onLeave || []).map((row) => ({ ...row, what: `${LEAVE_TYPES[row.type]} jusqu’au ${dayLabel(row.endDate)}` })),
              ...(data?.contractsEnding || []).map((row) => ({ ...row, what: `Contrat ${row.reference} : fin le ${dayLabel(row.endDate)}` })),
            ]}
            empty={<p className="dashboard-zero">Personne en congé aujourd’hui, aucun contrat ne se termine dans les 30 jours.</p>}
            columns={[
              { label: "Personne", render: (row) => <PersonCell name={row.staffId?.fullName} detail={row.staffId?.reference} /> },
              { label: "Information", render: (row) => row.what },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
