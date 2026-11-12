import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Plus, Sparkles } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import FormDialog from "../../components/FormDialog.jsx";
import { Alert, PageHeading, PersonCell, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useLookup, useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { SHIFTS, WEEKDAYS, dayLabel, monthLabel, shiftMonth, thisMonth, today } from "../../lib/format.js";
import { staffField, staffLabel } from "./fields.js";

// Horaires proposés par créneau (modifiables, et réglables dans les paramètres RH).
const SHIFT_TIMES = {
  matin: ["07:30", "12:30"],
  "apres-midi": ["13:00", "17:00"],
  soir: ["17:30", "21:30"],
  journee: ["08:00", "17:00"],
};
const shiftPicker = {
  key: "shift",
  label: "Créneau",
  type: "custom",
  default: "matin",
  render: ({ value, setValue }) => (
    <select
      value={value}
      onChange={(event) => {
        setValue("shift", event.target.value);
        const [start, end] = SHIFT_TIMES[event.target.value];
        setValue("startTime", start);
        setValue("endTime", end);
      }}
    >
      {Object.entries(SHIFTS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  ),
};
const timeFields = [
  { key: "startTime", label: "Début", type: "time", required: true, default: "07:30" },
  { key: "endTime", label: "Fin", type: "time", required: true, default: "12:30" },
];
const courseField = {
  key: "courseId",
  label: "Formation (facultatif)",
  type: "lookup",
  lookup: "courses",
  valueKey: "id",
  placeholder: "— Aucune —",
};
const ENTRY_STATUS = { planned: "Prévu", done: "Effectué", cancelled: "Annulé", replaced: "Remplacé" };
const entryFields = [
  staffField(),
  { key: "date", label: "Date", type: "date", required: true, default: today },
  shiftPicker,
  ...timeFields,
  { key: "label", label: "Classe ou poste", placeholder: "Ex. : Anglais A1 – groupe 2, Accueil" },
  courseField,
  { key: "room", label: "Salle" },
  { key: "status", label: "Statut", type: "select", options: Object.entries(ENTRY_STATUS) },
  staffField("replacementStaffId", "Remplaçant", { required: false, placeholder: "— Aucun —", show: (values) => values.status === "replaced" }),
  { key: "notes", label: "Notes", type: "textarea" },
];

function Calendar() {
  const admin = useAdmin();
  const [month, setMonth] = useState(thisMonth());
  const [staffId, setStaffId] = useState("");
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const staff = useLookup("staff", "active=1");
  const { data, error, reload, busy } = useRemote(
    `/rh/planning?from=${month}-01&to=${month}-31&all=1${staffId ? `&staffId=${staffId}` : ""}`,
  );
  const byDay = useMemo(() => {
    const map = {};
    for (const entry of data?.items || []) (map[entry.date] ||= []).push(entry);
    return map;
  }, [data]);
  // Grille du samedi au vendredi.
  const cells = useMemo(() => {
    const [year, index] = month.split("-").map(Number);
    const first = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(year, index, 0)).getUTCDate();
    const offset = (first + 1) % 7;
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, day) => `${month}-${String(day + 1).padStart(2, "0")}`),
    ];
  }, [month]);
  async function run(task, done) {
    setFailure("");
    try {
      setMessage(done(await task()));
      reload();
    } catch (problem) {
      setFailure(problem.message);
      setMessage("");
    }
  }
  const generate = () =>
    run(
      () => adminApi("/rh/planning/generate", { method: "POST", body: { month } }),
      (result) =>
        result.assignments
          ? `${result.created} séance(s) créée(s) à partir de ${result.assignments} affectation(s)${result.existing ? `, ${result.existing} déjà présente(s)` : ""}${result.skipped ? `, ${result.skipped} jour(s) de congé sauté(s)` : ""}.`
          : "Aucune affectation active ce mois-ci : créez d’abord les affectations (onglet « Affectations »).",
    );
  const clear = () =>
    window.confirm(`Retirer les séances générées et encore « prévues » de ${monthLabel(month).toLowerCase()} ?`) &&
    run(
      () => adminApi("/rh/planning/clear", { method: "POST", body: { month } }),
      (result) => `${result.deleted} séance(s) retirée(s).`,
    );
  const total = data?.items.length || 0;
  return (
    <>
      <div className="calendar-toolbar">
        <div className="month-switch">
          <button aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={18} />
          </button>
          <strong>{monthLabel(month)}</strong>
          <button aria-label="Mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <select value={staffId} onChange={(event) => setStaffId(event.target.value)} aria-label="Filtrer par personne">
          <option value="">Tout le personnel</option>
          {staff.map((item) => (
            <option key={item._id} value={item._id}>
              {staffLabel(item)}
            </option>
          ))}
        </select>
        <span className="calendar-count">{busy ? "Chargement…" : `${total} séance${total > 1 ? "s" : ""}`}</span>
        <div className="admin-heading-actions">
          {admin.can("rh.planning", "delete") && (
            <button className="button button-outline" onClick={clear}>
              <Eraser size={16} /> Vider le mois
            </button>
          )}
          {admin.can("rh.planning", "create") && (
            <>
              <button className="button button-outline" onClick={() => setEditor({ record: null })}>
                <Plus size={16} /> Séance ponctuelle
              </button>
              <button className="button" onClick={generate}>
                <Sparkles size={16} /> Générer le planning du mois
              </button>
            </>
          )}
        </div>
      </div>
      <Alert error={error || failure} success={message} />
      <div className="calendar" role="grid" aria-label={`Planning de ${monthLabel(month)}`}>
        {[6, 0, 1, 2, 3, 4, 5].map((day) => (
          <div key={day} className="calendar-head" role="columnheader">
            {WEEKDAYS[day]}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <div key={date} className={`calendar-day ${date === today() ? "is-today" : ""}`} role="gridcell">
              <span className="calendar-date">{Number(date.slice(8))}</span>
              {(byDay[date] || []).map((entry) => (
                <button
                  key={entry._id}
                  className={`calendar-entry shift-${entry.shift} status-${entry.status}`}
                  onClick={() => admin.can("rh.planning", "update") && setEditor({ record: entry })}
                  title={`${entry.startTime}–${entry.endTime} · ${entry.staffId?.fullName} · ${entry.label}${entry.room ? ` · salle ${entry.room}` : ""} · ${ENTRY_STATUS[entry.status]}`}
                >
                  <b>{entry.startTime}</b> {entry.staffId?.fullName?.split(" ")[0]}
                  <small>{entry.label}</small>
                </button>
              ))}
            </div>
          ) : (
            <div key={`empty-${index}`} className="calendar-day is-empty" aria-hidden="true" />
          ),
        )}
      </div>
      <ul className="calendar-legend">
        {Object.entries(SHIFTS).map(([key, label]) => (
          <li key={key}>
            <i className={`shift-${key}`} /> {label}
          </li>
        ))}
        <li>
          <i className="status-cancelled" /> Annulé (barré)
        </li>
      </ul>
      {editor && (
        <FormDialog
          title={editor.record ? `Séance du ${dayLabel(editor.record.date)}` : "Ajouter une séance"}
          fields={entryFields}
          initial={editor.record || { status: "planned" }}
          onClose={() => setEditor(null)}
          onSubmit={async (body) => {
            await adminApi(editor.record ? `/rh/planning/${editor.record._id}` : "/rh/planning", {
              method: editor.record ? "PATCH" : "POST",
              body,
            });
            setEditor(null);
            reload();
          }}
        >
          {editor.record && admin.can("rh.planning", "delete") && (
            <button
              type="button"
              className="admin-danger-link"
              onClick={async () => {
                if (!window.confirm("Supprimer cette séance ?")) return;
                await adminApi(`/rh/planning/${editor.record._id}`, { method: "DELETE" });
                setEditor(null);
                reload();
              }}
            >
              Supprimer cette séance
            </button>
          )}
        </FormDialog>
      )}
    </>
  );
}

export default function PlanningPage() {
  const [tab, setTab] = useState("calendar");
  return (
    <>
      <PageHeading
        kicker="RESSOURCES HUMAINES · ORGANISATION"
        title="Plannings et affectations"
        description="Affectez les enseignants aux classes et les employés à leurs créneaux (matin, après-midi, soir), puis générez automatiquement le planning de chaque mois."
      />
      <Tabs value={tab} onChange={setTab} tabs={[["calendar", "Planning du mois"], ["assignments", "Affectations"]]} />
      {tab === "calendar" ? (
        <Calendar />
      ) : (
        <ListPage
          heading={false}
          endpoint="/rh/assignments"
          section="rh.planning"
          search={false}
          createLabel="Nouvelle affectation"
          filters={[
            { key: "active", label: "État", default: "true", options: [["true", "Affectations actives"], ["false", "Affectations arrêtées"], ["", "Toutes"]] },
            { key: "kind", label: "Type", options: [["", "Cours et postes"], ["course", "Cours (enseignants)"], ["post", "Postes (employés)"]] },
          ]}
          columns={[
            { label: "Personne", render: (item) => <PersonCell name={item.staffId?.fullName} detail={item.staffId?.reference} /> },
            { label: "Classe / poste", render: (item) => <>{item.label}{item.room && <small className="cell-note">Salle {item.room}</small>}</> },
            { label: "Jours", render: (item) => [6, 0, 1, 2, 3, 4, 5].filter((day) => item.weekdays.includes(day)).map((day) => WEEKDAYS[day]).join(", ") },
            { label: "Horaire", render: (item) => `${item.startTime}–${item.endTime} · ${SHIFTS[item.shift]}` },
            { label: "Période", render: (item) => `${dayLabel(item.startDate)} → ${item.endDate ? dayLabel(item.endDate) : "sans fin"}` },
            { label: "État", render: (item) => <StatusPill status={item.active ? "active" : "ended"} label={item.active ? "Active" : "Arrêtée"} /> },
          ]}
          form={{
            title: "affectation",
            intro: "Une affectation se répète chaque semaine : « Générer le planning du mois » crée une séance pour chaque jour coché.",
            fields: [
              staffField(),
              { key: "kind", label: "Type", type: "select", options: [["course", "Cours (enseignant)"], ["post", "Poste (employé)"]] },
              { key: "label", label: "Classe ou poste", required: true, placeholder: "Ex. : Anglais A1 – groupe 2, Accueil du matin" },
              courseField,
              { key: "room", label: "Salle" },
              { key: "weekdays", label: "Jours de la semaine", type: "weekdays", required: true },
              shiftPicker,
              ...timeFields,
              { key: "startDate", label: "À partir du", type: "date", required: true, default: today },
              { key: "endDate", label: "Jusqu’au (facultatif)", type: "date" },
              { key: "active", label: "Affectation active", type: "checkbox", default: true },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
          }}
        />
      )}
    </>
  );
}
