import { useState } from "react";
import { Download } from "lucide-react";
import { FlowChart, HBars } from "../../components/Charts.jsx";
import { Alert, PageHeading, Panel, PeriodPicker, SimpleTable } from "../../components/ui.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { PAYMENT_METHODS, downloadCsv, money, monthStart, shiftMonth, thisMonth, today } from "../../lib/format.js";
import { monthsOf } from "./FinanceDashboard.jsx";

export default function FinanceReportsPage() {
  const [period, setPeriod] = useState({ from: monthStart(shiftMonth(thisMonth(), -11)), to: today() });
  const { data, error } = useRemote(`/finance/reports?from=${period.from}&to=${period.to}`, { delay: 200 });
  const months = monthsOf(data);
  const sum = (key) => months.reduce((total, row) => total + row[key], 0);
  const exportMonthly = () =>
    downloadCsv(
      `rapport-financier-${period.from}-${period.to}`,
      months.map((row) => ({
        Mois: row.title,
        "Paiements des students": row.students,
        Dépenses: row.expenses,
        Rémunérations: row.salaries,
        Avances: row.advances,
        "Total entrées": row.inflow,
        "Total sorties": row.outflow,
        "Solde du mois": row.inflow - row.outflow,
      })),
    );
  return (
    <>
      <PageHeading
        kicker="FINANCES · ANALYSE"
        title="Rapports financiers"
        description="Recettes, dépenses, rémunérations et résultat de trésorerie, par mois, par formation, par moyen de paiement et par catégorie."
      >
        <PeriodPicker {...period} onChange={setPeriod} />
        <button className="button button-outline" onClick={exportMonthly} disabled={!months.length}>
          <Download size={16} /> Exporter (CSV)
        </button>
      </PageHeading>
      <Alert error={error} />
      <div className="report-summary">
        <div><span>Recettes des students</span><b>{money(sum("students"))}</b></div>
        <div><span>Dépenses du centre</span><b>{money(sum("expenses"))}</b></div>
        <div><span>Rémunérations et avances</span><b>{money(sum("salaries") + sum("advances"))}</b></div>
        <div className={sum("inflow") - sum("outflow") < 0 ? "is-negative" : ""}><span>Résultat de trésorerie</span><b>{money(sum("inflow") - sum("outflow"))}</b></div>
      </div>
      <Panel title="Entrées et sorties par mois">
        {data ? <FlowChart label="Entrées et sorties par mois" format={money} items={months} /> : <div className="panel-skeleton" />}
      </Panel>
      <Panel title="Détail mensuel">
        <SimpleTable
          rows={months}
          rowKey={(row) => row.key}
          columns={[
            { label: "Mois", render: (row) => row.title },
            { label: "Students", align: "right", render: (row) => money(row.students) },
            { label: "Dépenses", align: "right", render: (row) => money(row.expenses) },
            { label: "Rémunérations", align: "right", render: (row) => money(row.salaries) },
            { label: "Avances", align: "right", render: (row) => money(row.advances) },
            { label: "Solde du mois", align: "right", render: (row) => <b className={row.inflow - row.outflow < 0 ? "amount-out" : ""}>{money(row.inflow - row.outflow)}</b> },
          ]}
        />
      </Panel>
      <div className="dashboard-grid dashboard-grid-thirds">
        <Panel title="Recettes par formation">
          <HBars items={(data?.byCourse || []).map((row) => ({ key: row.id, label: row.title, value: row.amount }))} format={money} />
        </Panel>
        <Panel title="Recettes par moyen de paiement">
          <HBars
            items={Object.entries(data?.byMethod || {}).map(([key, value]) => ({ key, label: PAYMENT_METHODS[key], value })).sort((a, b) => b.value - a.value)}
            format={money}
          />
        </Panel>
        <Panel title="Dépenses par catégorie">
          <HBars
            items={Object.entries(data?.byCategory || {}).map(([key, value]) => ({ key, label: key, value })).sort((a, b) => b.value - a.value)}
            format={money}
          />
        </Panel>
      </div>
    </>
  );
}
