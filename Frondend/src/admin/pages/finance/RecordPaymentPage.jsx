import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleDollarSign, FolderPlus } from "lucide-react";
import FileField from "../../components/FileField.jsx";
import PrintDocument from "../../components/PrintDocument.jsx";
import { Alert, Forbidden, PageHeading, Panel, SimpleTable, StatusPill } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel, money, today } from "../../lib/format.js";
import { SplitsEditor, StudentAccountPicker, toSplits } from "./fields.jsx";

// Même règle que le Backend : les paiements couvrent d’abord les échéances anciennes.
function schedule(account) {
  let left = account.paidAmount;
  const day = today();
  return [...account.installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => {
      const paid = Math.min(item.amount, Math.max(0, left));
      left -= paid;
      const remaining = item.amount - paid;
      return { ...item, paid, remaining, status: !remaining ? "paid" : item.dueDate < day ? "overdue" : paid ? "partial" : "upcoming" };
    });
}

export default function RecordPaymentPage() {
  const admin = useAdmin();
  const [account, setAccount] = useState(null);
  const [date, setDate] = useState(today());
  const [splits, setSplits] = useState([{ accountId: "", amount: "", transactionRef: "" }]);
  const [proofUrl, setProofUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  if (!admin.can("finance.payments", "create")) return <Forbidden />;
  const rows = account ? schedule(account) : [];
  function pick(item) {
    setAccount(item);
    setError("");
    const next = item && schedule(item).find((row) => row.remaining > 0);
    setSplits([{ accountId: "", amount: next ? String(next.remaining) : "", transactionRef: "" }]);
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { item } = await adminApi("/finance/payments", {
        method: "POST",
        body: { studentAccountId: account._id, date, splits: toSplits(splits), proofUrl, notes },
      });
      const detail = await adminApi(`/finance/payments/${item._id}`);
      setReceipt(detail.item);
      setAccount(null);
      setSplits([{ accountId: "", amount: "", transactionRef: "" }]);
      setProofUrl("");
      setNotes("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        kicker="FINANCES · PAIEMENTS DES STUDENTS"
        title="Enregistrer un paiement"
        description="Choisissez le dossier du student, puis le ou les moyens utilisés : D-Money, Waafi, CAC Pay, Saba Pay, espèces ou virement. Un reçu numéroté est généré."
      >
        {admin.can("finance.schedules", "create") && (
          <Link to="/admin/finance/echeanciers" className="button button-outline">
            <FolderPlus size={16} /> Nouveau dossier de student
          </Link>
        )}
      </PageHeading>
      <div className="dashboard-grid dashboard-grid-wide">
        <Panel title="1. Dossier du student">
          <div className="panel-body">
            <StudentAccountPicker value={account} onChange={pick} />
          </div>
          {account && (
            <SimpleTable
              rows={rows}
              rowKey={(row) => row._id}
              columns={[
                { label: "Échéance", render: (row) => row.label },
                { label: "Date", render: (row) => dayLabel(row.dueDate) },
                { label: "Montant", align: "right", render: (row) => money(row.amount) },
                { label: "Reste", align: "right", render: (row) => money(row.remaining) },
                { label: "Statut", render: (row) => <StatusPill status={row.status} /> },
              ]}
            />
          )}
        </Panel>
        <Panel title="2. Règlement">
          <form className="admin-form panel-body" onSubmit={submit}>
            <fieldset disabled={!account} className="payment-form">
              <label>
                <span className="editor-label">Date du paiement</span>
                <input type="date" value={date} max={today()} required onChange={(event) => setDate(event.target.value)} />
              </label>
              <div>
                <span className="editor-label">Moyens de paiement</span>
                <SplitsEditor value={splits} onChange={setSplits} />
              </div>
              <div>
                <span className="editor-label">Justificatif (capture du transfert, bordereau…)</span>
                <FileField value={proofUrl} onChange={setProofUrl} onBusyChange={setUploading} />
              </div>
              <label>
                <span className="editor-label">Notes</span>
                <textarea rows={2} value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </fieldset>
            <Alert error={error} />
            <div className="admin-editor-actions">
              <span className="editor-state">{account ? `Solde du dossier : ${money(account.balance)}` : "Choisissez d’abord un dossier."}</span>
              <button className="button" disabled={!account || busy || uploading}>
                <CircleDollarSign size={16} /> {busy ? "Enregistrement…" : "Enregistrer et imprimer le reçu"}
              </button>
            </div>
          </form>
        </Panel>
      </div>
      <p className="panel-note page-note">
        Confirmation automatique : elle sera possible quand l’intégration du prestataire (D-Money, Waafi, CAC Pay, Saba Pay) sera configurée. En attendant, chaque paiement est saisi manuellement avec sa référence de transaction et son justificatif.
      </p>
      {receipt && <PrintDocument kind="receipt" item={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
