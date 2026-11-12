import { useState } from "react";
import { Save } from "lucide-react";
import { FormFields, collect } from "../../components/FormDialog.jsx";
import { Alert, Forbidden, PageHeading, Panel } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { PAYMENT_METHODS } from "../../lib/format.js";

const fields = [
  { type: "heading", label: "En-tête des factures et reçus" },
  { key: "centreName", label: "Nom du centre", required: true },
  { key: "centrePhone", label: "Téléphone" },
  { key: "centreAddress", label: "Adresse", wide: true },
  { key: "centreEmail", label: "E-mail", type: "email" },
  { key: "taxId", label: "NIF / identifiant fiscal" },
  { key: "invoiceFooter", label: "Mention en bas des factures", type: "textarea" },
  { type: "heading", label: "Règles" },
  { key: "currency", label: "Devise", hint: "FDJ : franc Djibouti." },
  { key: "invoiceDueDays", label: "Délai de paiement d’une facture (jours)", type: "number", min: 0, maxValue: 120 },
  { key: "expenseApprovalThreshold", label: "Seuil de validation des dépenses", type: "money", hint: "À partir de ce montant, une dépense attend la validation d’un responsable. 0 = aucune validation." },
  {
    key: "paymentMethods",
    label: "Moyens de paiement acceptés",
    type: "custom",
    render: ({ value = [], set }) => (
      <div className="weekday-picker">
        {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={value.includes(key)}
            className={value.includes(key) ? "active" : ""}
            onClick={() => set(value.includes(key) ? value.filter((item) => item !== key) : [...value, key])}
          >
            {label}
          </button>
        ))}
      </div>
    ),
    hint: "La confirmation automatique des paiements mobiles nécessitera l’intégration de chaque prestataire (contrat et accès API).",
  },
];

function Form({ settings, editable }) {
  const [values, setValues] = useState(settings);
  const [state, setState] = useState({ busy: false, error: "", success: "" });
  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      await adminApi("/finance/settings", { method: "PUT", body: collect(fields, values) });
      setState({ busy: false, error: "", success: "Paramètres financiers enregistrés." });
    } catch (failure) {
      setState({ busy: false, error: failure.message, success: "" });
    }
  }
  return (
    <form className="admin-form settings-form" onSubmit={submit}>
      <fieldset disabled={!editable}>
        <FormFields fields={fields} values={values} setValue={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
      </fieldset>
      <Alert error={state.error} success={state.success} />
      {editable && (
        <div className="admin-editor-actions">
          <button className="button" disabled={state.busy}>
            <Save size={16} /> {state.busy ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
        </div>
      )}
    </form>
  );
}

export default function FinanceSettingsPage() {
  const admin = useAdmin();
  const allowed = admin.can("finance.settings");
  const { data, error } = useRemote(allowed ? "/finance/settings" : null);
  if (!allowed) return <Forbidden />;
  return (
    <>
      <PageHeading kicker="FINANCES" title="Paramètres financiers" description="En-tête des documents, devise, délais, seuil de validation et moyens de paiement." />
      <Alert error={error} />
      <Panel>
        <div className="panel-body">{data && <Form settings={data.settings} editable={admin.can("finance.settings", "update")} />}</div>
      </Panel>
    </>
  );
}
