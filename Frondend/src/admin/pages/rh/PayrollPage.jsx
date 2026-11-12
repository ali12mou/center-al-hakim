import { useState } from "react";
import { Calculator, CheckCheck, Printer, RotateCcw, Trash2, Check } from "lucide-react";
import PrintDocument from "../../components/PrintDocument.jsx";
import { Alert, Forbidden, PageHeading, Panel, PersonCell, StatGrid, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { PAY_TYPES, downloadCsv, hours, money, monthLabel, shiftMonth, thisMonth } from "../../lib/format.js";

const STATUS = { draft: "Brouillon", validated: "Validé", partial: "Partiellement payé", paid: "Payé" };

export default function PayrollPage({ mode = "calc" }) {
  const admin = useAdmin();
  const calc = mode === "calc";
  const [period, setPeriod] = useState(calc ? thisMonth() : "");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [printing, setPrinting] = useState(null);
  const allowed = admin.can("rh.payroll");
  const query = new URLSearchParams({ period, kind, status, q }).toString();
  const { data, error, reload, busy } = useRemote(allowed ? `/rh/payslips?${query}` : null, { delay: 150 });
  if (!allowed) return <Forbidden />;
  const items = data?.items || [];
  async function run(task, done) {
    setFailure("");
    try {
      const result = await task();
      setMessage(done(result));
      reload();
    } catch (problem) {
      setFailure(problem.message);
      setMessage("");
    }
  }
  const calculate = () =>
    run(
      () => adminApi("/rh/payroll/calculate", { method: "POST", body: { period } }),
      (result) =>
        `${result.calculated} bulletin(s) calculé(s) pour ${monthLabel(period).toLowerCase()}${result.locked ? ` · ${result.locked} déjà validé(s), non modifié(s)` : ""}.`,
    );
  const drafts = items.filter((item) => item.status === "draft");
  const validateAll = () =>
    window.confirm(`Valider les ${drafts.length} bulletin(s) brouillon(s) ? Ils pourront ensuite être payés par les finances.`) &&
    run(async () => {
      for (const item of drafts) await adminApi(`/rh/payslips/${item._id}/validate`, { method: "POST" });
    }, () => `${drafts.length} bulletin(s) validé(s).`);
  async function print(item) {
    try {
      setPrinting((await adminApi(`/rh/payslips/${item._id}`)).item);
    } catch (problem) {
      setFailure(problem.message);
    }
  }
  const totals = items.reduce(
    (sum, item) => ({ net: sum.net + item.net, paid: sum.paid + item.paidAmount, gross: sum.gross + item.gross }),
    { net: 0, paid: 0, gross: 0 },
  );
  return (
    <>
      <PageHeading
        kicker="RESSOURCES HUMAINES · PAIE"
        title={calc ? "Calcul des rémunérations" : "Bulletins de paie"}
        description={
          calc
            ? "Heures validées × tarif horaire pour les enseignants, salaire contractuel pour les employés, puis primes, retenues, absences et remboursements d’avance."
            : "Tous les bulletins : consultez, imprimez ou enregistrez-les en PDF."
        }
      >
        {calc && admin.can("rh.payroll", "approve") && drafts.length > 0 && (
          <button className="button button-outline" onClick={validateAll}>
            <CheckCheck size={16} /> Valider les brouillons ({drafts.length})
          </button>
        )}
        {calc && admin.can("rh.payroll", "create") && (
          <button className="button" onClick={calculate} disabled={!period}>
            <Calculator size={16} /> Calculer {period && monthLabel(period).toLowerCase()}
          </button>
        )}
        {!calc && (
          <button
            className="button button-outline"
            disabled={!items.length}
            onClick={() =>
              downloadCsv(
                `bulletins${period ? `-${period}` : ""}`,
                items.map((item) => ({
                  Bulletin: item.reference,
                  Mois: item.period,
                  Nom: item.staff.name,
                  Matricule: item.staff.reference,
                  Type: PAY_TYPES[item.payType],
                  Heures: item.hours,
                  Brut: item.gross,
                  Retenues: item.totalDeductions,
                  Net: item.net,
                  Versé: item.paidAmount,
                  Statut: STATUS[item.status],
                })),
              )
            }
          >
            Exporter (CSV)
          </button>
        )}
      </PageHeading>
      <Alert error={error || failure} success={message} />
      {calc && (
        <StatGrid
          loading={!data}
          className="money-stats"
          items={[
            { label: "Bulletins du mois", value: items.length, note: `${drafts.length} brouillon(s) à valider` },
            { label: "Total brut", value: money(totals.gross), note: "Salaires, heures et primes", tone: "blue" },
            { label: "Net à payer", value: money(totals.net), note: "Après retenues et avances", tone: "pink" },
            { label: "Déjà versé", value: money(totals.paid), note: `Reste ${money(totals.net - totals.paid)}`, tone: "green" },
          ]}
        />
      )}
      <div className="admin-resource-bar">
        <label className="filter-input">
          <span>Mois</span>
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        {calc && (
          <div className="month-switch compact">
            <button onClick={() => setPeriod(shiftMonth(period || thisMonth(), -1))} aria-label="Mois précédent">‹</button>
            <button onClick={() => setPeriod(shiftMonth(period || thisMonth(), 1))} aria-label="Mois suivant">›</button>
          </div>
        )}
        <label className="admin-search">
          <input value={q} placeholder="Nom de la personne…" onChange={(event) => setQ(event.target.value)} />
        </label>
        <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Type">
          <option value="">Enseignants et employés</option>
          <option value="teacher">Enseignants</option>
          <option value="employee">Employés</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <Panel className={busy && data ? "is-refreshing" : ""}>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Personne</th>
                <th>Mois</th>
                <th>Base</th>
                <th className="num">Brut</th>
                <th className="num">Retenues</th>
                <th className="num">Net</th>
                <th>Statut</th>
                <th className="actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td><PersonCell name={item.staff.name} detail={`${item.staff.reference} · ${item.staff.kind === "teacher" ? "Enseignant" : "Employé"}`} /></td>
                  <td className="nowrap">{monthLabel(item.period)}</td>
                  <td>{item.payType === "hourly" ? `${hours(item.hours)} × ${money(item.hourlyRate)}` : PAY_TYPES[item.payType]}</td>
                  <td className="num">{money(item.gross)}</td>
                  <td className="num">{item.totalDeductions ? `− ${money(item.totalDeductions)}` : "—"}</td>
                  <td className="num"><b>{money(item.net)}</b></td>
                  <td>
                    <StatusPill status={item.status} label={STATUS[item.status]} />
                    {item.paidAmount > 0 && item.status !== "paid" && <small className="cell-note">{money(item.paidAmount)} versés</small>}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button title="Imprimer le bulletin" aria-label="Imprimer" onClick={() => print(item)}>
                        <Printer size={16} />
                      </button>
                      {item.status === "draft" && admin.can("rh.payroll", "approve") && (
                        <button className="action-approve" title="Valider" aria-label="Valider" onClick={() => run(() => adminApi(`/rh/payslips/${item._id}/validate`, { method: "POST" }), () => "Bulletin validé.")}>
                          <Check size={16} />
                        </button>
                      )}
                      {item.status === "validated" && admin.can("rh.payroll", "approve") && (
                        <button title="Repasser en brouillon" aria-label="Repasser en brouillon" onClick={() => run(() => adminApi(`/rh/payslips/${item._id}/reopen`, { method: "POST" }), () => "Bulletin repassé en brouillon : recalculez-le si besoin.")}>
                          <RotateCcw size={16} />
                        </button>
                      )}
                      {item.status === "draft" && admin.can("rh.payroll", "delete") && (
                        <button className="action-delete" title="Supprimer" aria-label="Supprimer" onClick={() => window.confirm("Supprimer ce bulletin brouillon ?") && run(() => adminApi(`/rh/payslips/${item._id}`, { method: "DELETE" }), () => "Bulletin supprimé.")}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <p className="dashboard-zero">
            {busy
              ? "Chargement…"
              : calc
                ? "Aucun bulletin pour ce mois. Validez les présences puis cliquez sur « Calculer »."
                : "Aucun bulletin ne correspond à ces filtres."}
          </p>
        )}
      </Panel>
      {printing && <PrintDocument kind="payslip" item={printing} onClose={() => setPrinting(null)} />}
    </>
  );
}
