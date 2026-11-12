import { useEffect, useState } from "react";
import { CheckCheck, Save } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { Alert, PageHeading, Panel, PersonCell, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel, today } from "../../lib/format.js";
import { useCourseOptions, useCourseTitle } from "./LessonsPage.jsx";

export const STUDENT_ATTENDANCE = {
  present: "Présent",
  late: "En retard",
  absent: "Absent",
  excused: "Excusé",
};
const TONE = { present: "active", late: "pending", absent: "overdue", excused: "draft" };

function RollCall() {
  const admin = useAdmin();
  const courses = useCourseOptions("— Choisir une formation —");
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error: loadError, reload } = useRemote(
    courseId && date ? `/eleves/roll?courseId=${encodeURIComponent(courseId)}&date=${date}` : null,
  );
  const rows = data?.items || [];
  useEffect(() => {
    setMarks(Object.fromEntries(rows.map((row) => [row._id, { status: row.status, notes: row.notes }])));
    setSuccess("");
  }, [data]);
  const canSave = admin.can("eleves.attendance", "create");
  const set = (id, patch) => setMarks((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  async function save() {
    const entries = rows
      .filter((row) => marks[row._id]?.status)
      .map((row) => ({ studentAccountId: row._id, status: marks[row._id].status, notes: marks[row._id].notes || "" }));
    if (!entries.length) return setError("Indiquez la présence d’au moins un student.");
    setBusy(true);
    setError("");
    try {
      const result = await adminApi("/eleves/roll", { method: "POST", body: { courseId, date, entries } });
      setSuccess(`Appel enregistré : ${result.saved} student(s). Ils le voient dans leur application.`);
      reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const missing = rows.filter((row) => !marks[row._id]?.status).length;
  return (
    <>
      <div className="admin-resource-bar">
        <select value={courseId} onChange={(event) => setCourseId(event.target.value)} aria-label="Formation">
          {courses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="filter-input">
          <span>Date de la séance</span>
          <input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>
      <Alert error={error || loadError} success={success} />
      {!courseId ? (
        <Panel>
          <p className="dashboard-zero">Choisissez une formation pour afficher la liste des students.</p>
        </Panel>
      ) : (
        <Panel
          title={`Appel du ${dayLabel(date)}`}
          subtitle={rows.length ? `${rows.length} student(s) · ${missing ? `${missing} sans statut` : "tous renseignés"}` : undefined}
          action={
            canSave &&
            rows.length > 0 && (
              <button
                className="panel-action"
                onClick={() =>
                  setMarks((current) =>
                    Object.fromEntries(rows.map((row) => [row._id, { ...current[row._id], status: current[row._id]?.status || "present" }])),
                  )
                }
              >
                <CheckCheck size={14} /> Marquer les autres présents
              </button>
            )
          }
        >
          {rows.length ? (
            <div className="roll-list">
              {rows.map((row) => (
                <div className="roll-row" key={row._id}>
                  <PersonCell name={row.studentName} detail={row.reference} />
                  <div className="roll-choices" role="radiogroup" aria-label={`Présence de ${row.studentName}`}>
                    {Object.entries(STUDENT_ATTENDANCE).map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        role="radio"
                        aria-checked={marks[row._id]?.status === value}
                        className={marks[row._id]?.status === value ? `is-${value}` : ""}
                        disabled={!canSave}
                        onClick={() => set(row._id, { status: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="roll-note"
                    placeholder="Remarque (facultatif)"
                    maxLength={500}
                    value={marks[row._id]?.notes || ""}
                    disabled={!canSave}
                    onChange={(event) => set(row._id, { notes: event.target.value })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-zero">Aucun student avec un dossier actif dans cette formation.</p>
          )}
          {canSave && rows.length > 0 && (
            <div className="admin-editor-actions">
              <button className="button" onClick={save} disabled={busy}>
                <Save size={16} /> {busy ? "Enregistrement…" : "Enregistrer l’appel"}
              </button>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

export default function AttendancePage() {
  const [tab, setTab] = useState("roll");
  const courseOptions = useCourseOptions();
  const courseTitle = useCourseTitle();
  return (
    <>
      <PageHeading
        kicker="ESPACE STUDENTS · SUIVI PÉDAGOGIQUE"
        title="Présences des students"
        description="Faites l’appel par formation et par séance. Chaque student voit son taux de présence et son historique dans l’application."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["roll", "Faire l’appel"],
          ["history", "Historique"],
        ]}
      />
      {tab === "roll" ? (
        <RollCall />
      ) : (
        <ListPage
          heading={false}
          endpoint="/eleves/attendance"
          section="eleves.attendance"
          search="Nom du student…"
          creatable={false}
          exportName="presences-eleves"
          filters={[
            { key: "courseId", label: "Formation", options: courseOptions },
            { key: "status", label: "Statut", options: [["", "Tous les statuts"], ...Object.entries(STUDENT_ATTENDANCE)] },
            { key: "from", label: "Du" },
            { key: "to", label: "Au" },
          ]}
          columns={[
            { label: "Date", render: (item) => dayLabel(item.date), csv: (item) => item.date },
            { label: "Student", render: (item) => <PersonCell name={item.studentName} />, csv: (item) => item.studentName },
            { label: "Formation", render: (item) => courseTitle(item.courseId), csv: (item) => courseTitle(item.courseId) },
            {
              label: "Statut",
              render: (item) => <StatusPill status={TONE[item.status]} label={STUDENT_ATTENDANCE[item.status]} />,
              csv: (item) => STUDENT_ATTENDANCE[item.status],
            },
            { label: "Remarque", render: (item) => item.notes || "—", csv: (item) => item.notes },
            { label: "Saisi par", render: (item) => item.recordedBy?.name || "—" },
          ]}
          form={{
            title: "présence",
            fields: [
              { key: "status", label: "Statut", type: "select", options: Object.entries(STUDENT_ATTENDANCE) },
              { key: "notes", label: "Remarque", max: 500 },
            ],
          }}
        />
      )}
    </>
  );
}
