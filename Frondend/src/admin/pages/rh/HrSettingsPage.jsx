import { useState } from "react";
import { Save } from "lucide-react";
import { FormFields, collect } from "../../components/FormDialog.jsx";
import { Alert, Forbidden, PageHeading, Panel } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { SHIFTS, WEEKDAYS } from "../../lib/format.js";

const fields = [
  { type: "heading", label: "Créneaux de travail", hint: "Horaires proposés par défaut dans les affectations et les présences." },
  ...Object.entries(SHIFTS).flatMap(([key, label]) => [
    { key: `shifts.${key}.label`, label: `Nom du créneau « ${label} »` },
    { key: `shifts.${key}.start`, label: "Début", type: "time" },
    { key: `shifts.${key}.end`, label: "Fin", type: "time" },
  ]),
  { type: "heading", label: "Règles de paie" },
  { key: "defaultHourlyRate", label: "Tarif horaire par défaut des enseignants", type: "money" },
  { key: "workingDaysPerMonth", label: "Jours travaillés par mois", type: "number", min: 1, maxValue: 31, hint: "Sert au calcul d’une journée d’absence : salaire ÷ jours travaillés." },
  { key: "deductAbsences", label: "Retenir les absences non justifiées et les congés sans solde sur le salaire mensuel", type: "checkbox" },
  { key: "payday", label: "Jour habituel de paie", type: "number", min: 1, maxValue: 31 },
  { type: "heading", label: "Présences et congés" },
  { key: "lateToleranceMinutes", label: "Tolérance de retard (minutes)", type: "number", min: 0 },
  { key: "annualLeaveDays", label: "Jours de congé annuel", type: "number", min: 0 },
  {
    key: "weekend",
    label: "Jours non travaillés (exclus du décompte des congés)",
    type: "custom",
    render: ({ value = [], set }) => (
      <div className="weekday-picker">
        {[6, 0, 1, 2, 3, 4, 5].map((day) => (
          <button
            type="button"
            key={day}
            aria-pressed={value.includes(day)}
            className={value.includes(day) ? "active" : ""}
            onClick={() => set(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])}
          >
            {WEEKDAYS[day]}
          </button>
        ))}
      </div>
    ),
  },
];
const flatten = (settings) => {
  const values = { ...settings };
  for (const [key, shift] of Object.entries(settings.shifts || {}))
    for (const [part, value] of Object.entries(shift)) values[`shifts.${key}.${part}`] = value;
  return values;
};

function Form({ settings, editable, onSaved }) {
  const [values, setValues] = useState(() => flatten(settings));
  const [state, setState] = useState({ busy: false, error: "", success: "" });
  async function submit(event) {
    event.preventDefault();
    setState({ busy: true, error: "", success: "" });
    try {
      const result = await adminApi("/rh/settings", { method: "PUT", body: collect(fields, values) });
      onSaved(result.settings);
      setState({ busy: false, error: "", success: "Paramètres RH enregistrés." });
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

export default function HrSettingsPage() {
  const admin = useAdmin();
  const allowed = admin.can("rh.settings");
  const { data, error, reload } = useRemote(allowed ? "/rh/settings" : null);
  if (!allowed) return <Forbidden />;
  return (
    <>
      <PageHeading kicker="RESSOURCES HUMAINES" title="Paramètres RH" description="Créneaux, règles de paie, retards et congés." />
      <Alert error={error} />
      <Panel>
        <div className="panel-body">
          {data && <Form settings={data.settings} editable={admin.can("rh.settings", "update")} onSaved={reload} />}
        </div>
      </Panel>
    </>
  );
}
