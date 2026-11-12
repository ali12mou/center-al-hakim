import { useState } from "react";
import { Banknote, Check, Plus } from "lucide-react";
import FormDialog from "../../components/FormDialog.jsx";
import { Alert, Forbidden, PageHeading, Panel, PersonCell, SimpleTable, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { PAYMENT_METHODS, dayLabel, money, monthLabel, thisMonth, today } from "../../lib/format.js";
import { staffField } from "../rh/fields.js";
import { accountField } from "./fields.jsx";

const state = (item) =>
  item.status === "pending"
    ? ["pending", "À accorder (RH / direction)"]
    : item.status !== "approved"
      ? [item.status, item.status === "rejected" ? "Refusée" : "Annulée"]
      : !item.disbursed?.paid
        ? ["upcoming", "Accordée, à verser"]
        : item.remaining
          ? ["partial", "Versée, en remboursement"]
          : ["paid", "Remboursée"];

function Advances() {
  const admin = useAdmin();
  const { data, error, reload } = useRemote("/finance/advances");
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const done = (text) => {
    setMessage(text);
    setFailure("");
    setDialog(null);
    reload();
  };
  async function approve(item) {
    try {
      await adminApi(`/rh/adjustments/${item._id}/decision`, { method: "POST", body: { status: "approved" } });
      done("Avance accordée : elle peut être versée.");
    } catch (problem) {
      setFailure(problem.message);
    }
  }
  return (
    <>
      <div className="list-toolbar admin-heading-actions">
        {admin.can("finance.advances", "create") && (
          <button className="button" onClick={() => setDialog({ kind: "create" })}>
            <Plus size={16} /> Nouvelle avance
          </button>
        )}
      </div>
      <Alert error={error || failure} success={message} />
      <Panel>
        <SimpleTable
          rows={data?.items}
          empty={<p className="dashboard-zero">Aucune avance pour le moment.</p>}
          columns={[
            { label: "Personne", render: (row) => <PersonCell name={row.staffId?.fullName} detail={row.label || row.staffId?.reference} /> },
            { label: "Montant", align: "right", render: (row) => money(row.amount) },
            { label: "Remboursement", render: (row) => `${row.repaymentMonths} mois dès ${monthLabel(row.repaymentStart || row.period).toLowerCase()}` },
            { label: "Versement", render: (row) => (row.disbursed?.paid ? `${dayLabel(row.disbursed.paidAt?.slice(0, 10))} · ${PAYMENT_METHODS[row.disbursed.method]}` : "—") },
            { label: "Déjà retenu", align: "right", render: (row) => money(row.repaid) },
            { label: "Reste dû", align: "right", render: (row) => <b>{money(row.remaining)}</b> },
            { label: "Statut", render: (row) => <StatusPill status={state(row)[0]} label={state(row)[1]} /> },
            {
              label: "Actions",
              render: (row) => (
                <div className="admin-actions">
                  {row.status === "pending" && admin.can("rh.adjustments", "approve") && (
                    <button className="action-approve" title="Accorder" aria-label="Accorder" onClick={() => approve(row)}>
                      <Check size={16} />
                    </button>
                  )}
                  {row.status === "approved" && !row.disbursed?.paid && admin.can("finance.advances", "approve") && (
                    <button className="action-approve" title="Verser l’avance" aria-label="Verser l’avance" onClick={() => setDialog({ kind: "disburse", item: row })}>
                      <Banknote size={16} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      {dialog?.kind === "create" && (
        <FormDialog
          title="Nouvelle avance"
          intro="L’avance est d’abord accordée par les RH ou la direction, puis versée ici. Elle est ensuite retenue automatiquement sur les bulletins."
          initial={{ period: thisMonth(), repaymentMonths: 2 }}
          fields={[
            staffField(),
            { key: "amount", label: "Montant", type: "money", required: true },
            { key: "label", label: "Motif", placeholder: "Ex. : Frais médicaux, rentrée scolaire" },
            { key: "period", label: "Mois de l’avance", type: "month", required: true },
            { key: "repaymentMonths", label: "Rembourser sur (mois)", type: "number", min: 1, maxValue: 12 },
            { key: "repaymentStart", label: "Première retenue", type: "month", hint: "Ex. : à la fin du mois suivant. Par défaut, le mois de l’avance." },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          onClose={() => setDialog(null)}
          onSubmit={async (body) => {
            await adminApi("/finance/advances", { method: "POST", body });
            done("Avance enregistrée : elle doit être accordée avant d’être versée.");
          }}
        />
      )}
      {dialog?.kind === "disburse" && (
        <FormDialog
          title={`Verser l’avance · ${dialog.item.staffId?.fullName}`}
          intro={`Montant : ${money(dialog.item.amount)}. Le compte choisi est débité.`}
          initial={{ date: today() }}
          fields={[
            { key: "date", label: "Date du versement", type: "date", required: true },
            accountField("accountId", "Compte de décaissement"),
            { key: "reference", label: "Référence de transaction" },
          ]}
          submitLabel="Verser"
          onClose={() => setDialog(null)}
          onSubmit={async (body) => {
            await adminApi(`/finance/advances/${dialog.item._id}/disburse`, { method: "POST", body });
            done("Avance versée : elle sera retenue sur les prochains salaires.");
          }}
        />
      )}
    </>
  );
}

function Balances() {
  const { data, error } = useRemote("/finance/staff-balances");
  return (
    <>
      <Alert error={error} />
      <Panel subtitle="Salaires validés non encore versés et avances restant à rembourser">
        <SimpleTable
          rows={data?.items}
          rowKey={(row) => String(row.staffId)}
          empty={<p className="dashboard-zero">Aucun solde en attente.</p>}
          columns={[
            { label: "Personne", render: (row) => <PersonCell name={row.name} detail={`${row.reference || ""} · ${row.kind === "teacher" ? "Enseignant" : "Employé"}`} /> },
            { label: "Bulletins non soldés", align: "right", render: (row) => row.slips },
            { label: "Reste à lui payer", align: "right", render: (row) => <b>{money(row.salaryDue)}</b> },
            { label: "Avance à rembourser", align: "right", render: (row) => money(row.advanceOutstanding) },
          ]}
        />
      </Panel>
    </>
  );
}

export default function AdvancesPage() {
  const admin = useAdmin();
  const [tab, setTab] = useState("advances");
  if (!admin.can("finance.advances")) return <Forbidden />;
  return (
    <>
      <PageHeading
        kicker="FINANCES · PAIEMENTS DU PERSONNEL"
        title="Avances et soldes à payer"
        description="Avances accordées au personnel (enseignants compris), leur versement et leur remboursement sur les salaires, et les sommes restant dues."
      />
      <Tabs value={tab} onChange={setTab} tabs={[["advances", "Avances"], ["balances", "Soldes à payer"]]} />
      {tab === "advances" ? <Advances /> : <Balances />}
    </>
  );
}
