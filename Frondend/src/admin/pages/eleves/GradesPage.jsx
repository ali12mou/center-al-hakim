import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { Alert, PageHeading, Panel, PersonCell, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel, today } from "../../lib/format.js";
import { useCourseOptions, useCourseTitle } from "./LessonsPage.jsx";

const decimal = (value) => String(value).replace(".", ",");

// Une évaluation (devoir, examen…) notée pour tous les students d’une formation.
function BatchEntry({ onSaved }) {
  const admin = useAdmin();
  const courses = useCourseOptions("— Choisir une formation —");
  const [form, setForm] = useState({ courseId: "", title: "", date: today(), maxScore: 20, published: true });
  const [scores, setScores] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, error: loadError } = useRemote(
    form.courseId ? `/eleves/students?courseId=${encodeURIComponent(form.courseId)}&all=1` : null,
  );
  const rows = data?.items || [];
  useEffect(() => setScores({}), [form.courseId]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setScore = (id, patch) => setScores((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  async function save(event) {
    event.preventDefault();
    const entries = rows
      .filter((row) => scores[row._id]?.score !== undefined && scores[row._id].score !== "")
      .map((row) => ({
        studentAccountId: row._id,
        score: Number(String(scores[row._id].score).replace(",", ".")),
        comment: scores[row._id].comment || "",
      }));
    if (!entries.length) return setError("Saisissez au moins une note.");
    if (entries.some((entry) => Number.isNaN(entry.score))) return setError("Une note n’est pas un nombre valide.");
    setBusy(true);
    setError("");
    try {
      const result = await adminApi("/eleves/grades/batch", {
        method: "POST",
        body: { ...form, maxScore: Number(form.maxScore), entries },
      });
      setSuccess(`${result.saved} note(s) enregistrée(s) pour « ${form.title} ».`);
      setScores({});
      set("title", "");
      onSaved?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  if (!admin.can("eleves.grades", "create"))
    return (
      <Panel>
        <p className="dashboard-zero">Votre compte peut consulter les notes, mais pas en ajouter.</p>
      </Panel>
    );
  return (
    <form onSubmit={save}>
      <Panel title="Nouvelle évaluation">
        <div className="admin-form-grid">
          <label>
            <span className="editor-label">
              Formation<em>*</em>
            </span>
            <select required value={form.courseId} onChange={(event) => set("courseId", event.target.value)}>
              {courses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="editor-label">
              Intitulé<em>*</em>
            </span>
            <input required maxLength={150} placeholder="Ex. : Contrôle n°1, Examen final…" value={form.title} onChange={(event) => set("title", event.target.value)} />
          </label>
          <label>
            <span className="editor-label">
              Date<em>*</em>
            </span>
            <input type="date" required value={form.date} onChange={(event) => set("date", event.target.value)} />
          </label>
          <label>
            <span className="editor-label">Barème (note sur)</span>
            <input type="number" min={1} max={1000} required value={form.maxScore} onChange={(event) => set("maxScore", event.target.value)} />
          </label>
          <label className="admin-switch admin-full">
            <input type="checkbox" role="switch" checked={form.published} onChange={(event) => set("published", event.target.checked)} />
            <span className="admin-switch-track" aria-hidden="true" />
            <span className="admin-switch-text">
              <strong>Visible tout de suite par les students</strong>
              <small>Décochez pour saisir les notes sans les publier.</small>
            </span>
          </label>
        </div>
      </Panel>
      <Alert error={error || loadError} success={success} />
      {form.courseId && (
        <Panel title="Notes des students" subtitle="Laissez vide pour un student absent ou non noté.">
          {rows.length ? (
            <div className="roll-list">
              {rows.map((row) => (
                <div className="roll-row" key={row._id}>
                  <PersonCell name={row.studentName} detail={row.reference} />
                  <label className="grade-input">
                    <input
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Note de ${row.studentName}`}
                      value={scores[row._id]?.score ?? ""}
                      onChange={(event) => setScore(row._id, { score: event.target.value })}
                    />
                    <span>/ {form.maxScore || 20}</span>
                  </label>
                  <input
                    className="roll-note"
                    placeholder="Appréciation (facultatif)"
                    maxLength={1000}
                    value={scores[row._id]?.comment || ""}
                    onChange={(event) => setScore(row._id, { comment: event.target.value })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-zero">Aucun student avec un dossier actif dans cette formation.</p>
          )}
          {rows.length > 0 && (
            <div className="admin-editor-actions">
              <button className="button" disabled={busy}>
                <Save size={16} /> {busy ? "Enregistrement…" : "Enregistrer les notes"}
              </button>
            </div>
          )}
        </Panel>
      )}
    </form>
  );
}

export default function GradesPage() {
  const [tab, setTab] = useState("new");
  const [version, setVersion] = useState(0);
  const courseOptions = useCourseOptions();
  const courseTitle = useCourseTitle();
  return (
    <>
      <PageHeading
        kicker="ESPACE STUDENTS · SUIVI PÉDAGOGIQUE"
        title="Notes et évaluations"
        description="Saisissez les notes d’un contrôle ou d’un examen pour toute une formation. Chaque student voit uniquement ses propres notes et sa moyenne."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["new", "Saisir une évaluation"],
          ["list", "Notes enregistrées"],
        ]}
      />
      {tab === "new" ? (
        <BatchEntry onSaved={() => setVersion((value) => value + 1)} />
      ) : (
        <ListPage
          key={version}
          heading={false}
          endpoint="/eleves/grades"
          section="eleves.grades"
          search="Student ou évaluation…"
          creatable={false}
          exportName="notes-eleves"
          filters={[
            { key: "courseId", label: "Formation", options: courseOptions },
            { key: "from", label: "Du" },
            { key: "to", label: "Au" },
          ]}
          deleteConfirm={(item) => `Supprimer la note de ${item.studentName} (« ${item.title} ») ?`}
          columns={[
            { label: "Date", render: (item) => dayLabel(item.date), csv: (item) => item.date },
            { label: "Évaluation", render: (item) => <strong>{item.title}</strong>, csv: (item) => item.title },
            { label: "Student", render: (item) => <PersonCell name={item.studentName} />, csv: (item) => item.studentName },
            { label: "Formation", render: (item) => courseTitle(item.courseId), csv: (item) => courseTitle(item.courseId) },
            {
              label: "Note",
              align: "right",
              render: (item) => (
                <b className={item.score / item.maxScore >= 0.5 ? "grade-good" : "grade-low"}>
                  {decimal(item.score)} / {item.maxScore}
                </b>
              ),
              csv: (item) => `${decimal(item.score)}/${item.maxScore}`,
            },
            {
              label: "Statut",
              render: (item) => <StatusPill status={item.published ? "active" : "draft"} label={item.published ? "Publiée" : "Masquée"} />,
              csv: (item) => (item.published ? "Publiée" : "Masquée"),
            },
          ]}
          form={{
            title: "note",
            fields: [
              { key: "title", label: "Évaluation", required: true, max: 150 },
              { key: "date", label: "Date", type: "date", required: true },
              { key: "score", label: "Note", type: "number", min: 0, step: 0.25, required: true },
              { key: "maxScore", label: "Barème", type: "number", min: 1, required: true },
              { key: "comment", label: "Appréciation", type: "textarea", max: 1000 },
              { key: "published", label: "Visible par le student", type: "checkbox" },
            ],
          }}
        />
      )}
    </>
  );
}
