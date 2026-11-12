import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CircleDollarSign, CreditCard, HandCoins, Receipt, SquarePen, TrendingUp, UserCheck, Users, UserX } from "lucide-react";
import { FlowChart, HBars } from "../../components/Charts.jsx";
import { Alert, PageHeading, Panel, PersonCell, SimpleTable, StatGrid } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { ACCOUNT_KINDS, PAYMENT_METHODS, dayLabel, money, monthLabel, monthStart, shiftMonth, shortMonthLabel, thisMonth, today } from "../../lib/format.js";

export const PRESETS = [
  ["month", "Ce mois-ci", () => ({ from: monthStart(), to: today() })],
  ["quarter", "3 derniers mois", () => ({ from: monthStart(shiftMonth(thisMonth(), -2)), to: today() })],
  ["half", "6 derniers mois", () => ({ from: monthStart(shiftMonth(thisMonth(), -5)), to: today() })],
  ["year", "Cette année", () => ({ from: `${thisMonth().slice(0, 4)}-01-01`, to: today() })],
];
export function PresetPicker({ value, onChange }) {
  return (
    <div className="preset-picker" role="group" aria-label="Période">
      {PRESETS.map(([id, label]) => (
        <button key={id} className={value === id ? "active" : ""} aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
// Tous les mois de la période, même sans mouvement (barres à zéro).
export function monthsOf(data) {
  if (!data) return [];
  const rows = [];
  for (let month = data.period.from.slice(0, 7); month <= data.period.to.slice(0, 7); month = shiftMonth(month, 1)) {
    const row = data.monthly.find((item) => item.month === month) || {};
    rows.push({
      key: month,
      label: shortMonthLabel(month),
      title: monthLabel(month),
      inflow: row.inflow || 0,
      outflow: row.outflow || 0,
      students: row.student_payment || 0,
      expenses: row.expense || 0,
      salaries: row.staff_payment || 0,
      advances: row.advance || 0,
    });
  }
  return rows;
}
const bars = (map, labels = {}) =>
  Object.entries(map)
    .map(([key, value]) => ({ key, label: labels[key] || key, value }))
    .sort((a, b) => b.value - a.value);

export default function FinanceDashboard() {
  const admin = useAdmin();
  const [preset, setPreset] = useState("half");
  const period = PRESETS.find(([id]) => id === preset)[2]();
  const { data, error } = useRemote(`/finance/dashboard?from=${period.from}&to=${period.to}`);
  const totals = data?.totals;
  const label = PRESETS.find(([id]) => id === preset)[1].toLowerCase();
  const studentsLink = (payment) =>
    admin.can("finance.students") ? `/admin/finance/eleves${payment ? `?paiement=${payment}` : ""}` : undefined;
  const percent = (part, total) => (total ? `${Math.round((part / total) * 100)} %` : "0 %");
  return (
    <>
      <PageHeading
        kicker="FINANCES"
        title="Tableau de bord financier"
        description="Encaissements, restes à recevoir, échéances, salaires, dépenses et soldes des comptes."
      >
        <PresetPicker value={preset} onChange={setPreset} />
        {admin.can("finance.payments", "create") && (
          <Link to="/admin/finance/encaissements" className="button">
            <CircleDollarSign size={17} /> Encaisser
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
                { icon: TrendingUp, label: `Encaissé (${label})`, value: money(totals.collected), note: "Paiements des students confirmés", tone: "green", to: admin.can("finance.payments") ? "/admin/finance/encaissements" : undefined },
                { icon: Receipt, label: "Reste à recevoir", value: money(totals.receivable), note: `${money(totals.overdueAmount)} en retard`, tone: "pink", to: admin.can("finance.schedules") ? "/admin/finance/impayes" : undefined },
                { icon: CreditCard, label: `Dépenses (${label})`, value: money(totals.expenses), note: `${totals.pendingExpenses} dépense(s) à valider`, to: admin.can("finance.expenses") ? "/admin/finance/depenses" : undefined },
                { icon: HandCoins, label: "Salaires restant à verser", value: money(totals.salariesDue), note: `${money(totals.salariesPaid)} versés · ${totals.pendingStaff} en cours`, tone: "blue", to: admin.can("finance.staffPayments") ? "/admin/finance/salaires" : undefined },
              ]
            : []
        }
      />
      {data?.students && (
        <StatGrid
          className="student-pay-stats"
          items={[
            { icon: Users, label: "Students inscrits", value: data.students.total, note: "Inscrits confirmés ou avec un dossier", tone: "blue", to: studentsLink() },
            {
              icon: UserCheck,
              label: "Students ayant payé",
              value: data.students.paid,
              note: `${percent(data.students.paid, data.students.total)} · dont ${data.students.upToDate} soldé(s)`,
              tone: "green",
              to: studentsLink("paid"),
            },
            {
              icon: UserX,
              label: "Students sans paiement",
              value: data.students.unpaid,
              note: `${percent(data.students.unpaid, data.students.total)} des inscrits`,
              tone: "pink",
              to: studentsLink("unpaid"),
            },
          ]}
        />
      )}
      <div className="dashboard-grid dashboard-grid-wide">
        <Panel title="Entrées et sorties de trésorerie" subtitle="Par mois, hors transferts entre comptes">
          {data ? <FlowChart label="Entrées et sorties de trésorerie par mois" format={money} items={monthsOf(data)} /> : <div className="panel-skeleton" />}
        </Panel>
        <Panel
          title="Soldes des comptes"
          subtitle={data ? `Total : ${money(data.balances.filter((item) => item.active).reduce((sum, item) => sum + item.balance, 0))}` : ""}
        >
          <ul className="balance-list">
            {(data?.balances || [])
              .filter((item) => item.active)
              .map((item) => (
                <li key={item._id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{ACCOUNT_KINDS[item.kind]}</small>
                  </span>
                  <b className={item.balance < 0 ? "amount-out" : ""}>{money(item.balance)}</b>
                </li>
              ))}
          </ul>
          {admin.can("finance.accounts") && (
            <Link to="/admin/finance/comptes/cash" className="panel-footer-link">
              Caisse et comptes <ArrowUpRight size={15} />
            </Link>
          )}
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Impayés" subtitle="Échéances dépassées, par student" action={admin.can("finance.schedules") && <Link to="/admin/finance/impayes">Tout voir <ArrowUpRight size={15} /></Link>}>
          <SimpleTable
            rows={data?.overdue.slice(0, 8)}
            rowKey={(row) => `${row.accountId}-${row.dueDate}`}
            empty={<p className="dashboard-zero">Aucun impayé.</p>}
            columns={[
              { label: "Student", render: (row) => <PersonCell name={row.studentName} detail={row.courseTitle} /> },
              { label: "Échéance", render: (row) => dayLabel(row.dueDate) },
              { label: "Reste", align: "right", render: (row) => <b>{money(row.remaining)}</b> },
            ]}
          />
        </Panel>
        <Panel title="Échéances à venir" subtitle="Dans les 30 prochains jours">
          <SimpleTable
            rows={data?.upcoming}
            rowKey={(row) => `${row.accountId}-${row.dueDate}`}
            empty={<p className="dashboard-zero">Aucune échéance dans les 30 prochains jours.</p>}
            columns={[
              { label: "Student", render: (row) => <PersonCell name={row.studentName} detail={row.label} /> },
              { label: "Date", render: (row) => dayLabel(row.dueDate) },
              { label: "Montant", align: "right", render: (row) => money(row.remaining) },
            ]}
          />
        </Panel>
      </div>
      <div className="dashboard-grid dashboard-grid-thirds">
        <Panel title="Recettes par moyen de paiement">
          <HBars items={bars(data?.byMethod || {}, PAYMENT_METHODS)} format={money} />
        </Panel>
        <Panel title="Recettes par formation">
          <HBars items={(data?.byCourse || []).map((row) => ({ key: row.id, label: row.title, value: row.amount }))} format={money} />
        </Panel>
        <Panel title="Dépenses par catégorie" action={admin.can("finance.expenses", "create") && <Link to="/admin/finance/depenses/nouvelle"><SquarePen size={15} /> Nouvelle</Link>}>
          <HBars items={bars(data?.byCategory || {})} format={money} />
        </Panel>
      </div>
    </>
  );
}
