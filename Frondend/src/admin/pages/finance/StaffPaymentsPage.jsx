import { useState } from "react";
import { Banknote, Check, HandCoins, X } from "lucide-react";
import FormDialog from "../../components/FormDialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import { Alert, Panel, PersonCell, SimpleTable, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi, fileUrl } from "../../services/adminApi.js";
import { PAYMENT_METHODS, PAY_TYPES, dayLabel, hours, money, monthLabel, today } from "../../lib/format.js";
import { accountField } from "./fields.jsx";

const STATUS = { pending: "À valider (direction)", approved: "Validé, à décaisser", paid: "Versé", rejected: "Refusé" };

export default function StaffPaymentsPage({ kind }) {
  const admin = useAdmin();
  const teacher = kind === "teacher";
  const due = useRemote(admin.can("finance.staffPayments") ? `/finance/payroll-due?kind=${kind}` : null);
  const [preparing, setPreparing] = useState(null);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const toPay = (due.data?.items || []).filter((slip) => slip.remaining > 0);
  const refresh = () => {
    due.reload();
    setVersion((value) => value + 1);
  };
  return (
    <>
      <ListPage
        key={version}
        kicker="FINANCES · PAIEMENTS DU PERSONNEL"
        title={teacher ? "Rémunérations des enseignants" : "Salaires des employés"}
        description={
          teacher
            ? "Paiement des enseignants selon les heures validées ou le forfait convenu. La direction valide chaque paiement avant le décaissement."
            : "Paiement des salaires mensuels à partir des bulletins validés par les RH. La direction valide chaque paiement avant le décaissement."
        }
        endpoint="/finance/staff-payments"
        section="finance.staffPayments"
        query={{ staffKind: kind }}
        search="Nom, référence…"
        exportName={teacher ? "remunerations-enseignants" : "salaires-employes"}
        filters={[
          { key: "status", label: "Statut", options: [["", "Tous les paiements"], ...Object.entries(STATUS)] },
          { key: "period", label: "Mois", type: "month" },
        ]}
        onChanged={due.reload}
        editable={(item) => item.status === "pending"}
        deletable={(item) => ["pending", "rejected"].includes(item.status)}
        actions={(item, ctx) => [
          admin.can("finance.staffPayments", "approve") &&
            item.status === "pending" && {
              icon: Check,
              label: "Valider (direction)",
              tone: "approve",
              onClick: () => ctx.run(() => adminApi(`/finance/staff-payments/${item._id}/approve`, { method: "POST" }), "Paiement validé : il peut être décaissé."),
            },
          admin.can("finance.staffPayments", "approve") &&
            ["pending", "approved"].includes(item.status) && {
              icon: X,
              label: "Refuser",
              tone: "delete",
              onClick: () => window.confirm("Refuser ce paiement ?") && ctx.run(() => adminApi(`/finance/staff-payments/${item._id}/reject`, { method: "POST" }), "Paiement refusé."),
            },
          admin.can("finance.staffPayments", "update") &&
            item.status === "approved" && {
              icon: Banknote,
              label: "Marquer comme versé",
              tone: "approve",
              onClick: () => {
                const transactionRef = window.prompt("Référence de la transaction (facultative) :", item.transactionRef || "");
                if (transactionRef === null) return;
                ctx.run(
                  () => adminApi(`/finance/staff-payments/${item._id}/pay`, { method: "POST", body: { transactionRef, date: today() } }),
                  "Paiement versé : le bulletin et le solde du compte sont à jour.",
                );
              },
            },
        ]}
        columns={[
          { label: "Référence", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
          { label: teacher ? "Enseignant" : "Employé", render: (item) => <PersonCell name={item.staffName} detail={monthLabel(item.period)} />, csv: (item) => item.staffName },
          { label: "Montant", align: "right", render: (item) => <b>{money(item.amount)}</b>, csv: (item) => item.amount },
          { label: "Compte", render: (item) => `${PAYMENT_METHODS[item.method]} · ${item.accountId?.name || ""}`, csv: (item) => PAYMENT_METHODS[item.method] },
          { label: "Date", render: (item) => dayLabel(item.date), csv: (item) => item.date },
          {
            label: "Statut",
            render: (item) => (
              <>
                <StatusPill status={item.status === "approved" ? "upcoming" : item.status} label={STATUS[item.status]} />
                {item.approvedBy?.name && <small className="cell-note">Validé par {item.approvedBy.name}</small>}
                {item.proofUrl && (
                  <a className="doc-link" href={fileUrl(item.proofUrl)} target="_blank" rel="noreferrer">
                    Justificatif
                  </a>
                )}
              </>
            ),
            csv: (item) => STATUS[item.status],
          },
        ]}
        form={{
          title: "paiement",
          fields: [
            { key: "amount", label: "Montant", type: "money", required: true },
            { key: "date", label: "Date prévue", type: "date", required: true },
            accountField("accountId", "Compte de décaissement"),
            { key: "transactionRef", label: "Référence de transaction" },
            { key: "proofUrl", label: "Justificatif", type: "file" },
            { key: "notes", label: "Notes", type: "textarea" },
          ],
        }}
      >
        {admin.can("finance.staffPayments", "create") && (
          <Panel title="Bulletins validés à payer" subtitle={`${toPay.length} bulletin(s) avec un reste à payer`}>
            <Alert error={due.error} success={message} />
            <SimpleTable
              rows={toPay}
              empty={<p className="dashboard-zero">Rien à payer : les bulletins validés par les RH apparaîtront ici.</p>}
              columns={[
                { label: "Personne", render: (row) => <PersonCell name={row.staff.name} detail={row.staff.reference} /> },
                { label: "Mois", render: (row) => monthLabel(row.period) },
                { label: "Base", render: (row) => (row.payType === "hourly" ? `${hours(row.hours)} × ${money(row.hourlyRate)}` : PAY_TYPES[row.payType]) },
                { label: "Net", align: "right", render: (row) => money(row.net) },
                { label: "En cours", align: "right", render: (row) => (row.engaged ? money(row.engaged) : "—") },
                { label: "Reste à payer", align: "right", render: (row) => <b>{money(row.remaining)}</b> },
                {
                  label: "",
                  render: (row) => (
                    <button className="panel-action" onClick={() => setPreparing(row)}>
                      <HandCoins size={14} /> Préparer le paiement
                    </button>
                  ),
                },
              ]}
            />
          </Panel>
        )}
      </ListPage>
      {preparing && (
        <FormDialog
          title={`Paiement · ${preparing.staff.name} · ${monthLabel(preparing.period)}`}
          intro="Le paiement sera soumis à la validation de la direction, puis marqué comme versé lors du décaissement."
          initial={{ amount: preparing.remaining, date: today() }}
          fields={[
            { key: "amount", label: "Montant", type: "money", required: true, hint: `Reste à payer : ${money(preparing.remaining)}. Un paiement partiel est possible.` },
            { key: "date", label: "Date prévue", type: "date", required: true },
            accountField("accountId", "Compte de décaissement"),
            { key: "transactionRef", label: "Référence de transaction" },
            { key: "proofUrl", label: "Justificatif", type: "file" },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          onClose={() => setPreparing(null)}
          onSubmit={async (body) => {
            await adminApi("/finance/staff-payments", { method: "POST", body: { ...body, payslipId: preparing._id } });
            setPreparing(null);
            setMessage("Paiement préparé : il attend la validation de la direction.");
            refresh();
          }}
        />
      )}
    </>
  );
}
