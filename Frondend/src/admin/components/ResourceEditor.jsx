import { useEffect, useRef, useState } from "react";
import { CircleCheck, Save } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import QuestionsEditor from "./QuestionsEditor.jsx";
import ImageUpload from "./ImageUpload.jsx";
import { adminApi } from "../services/adminApi.js";

// Rubriques du formulaire : déduites du type de champ, sauf `group` explicite.
const groupOf = (field) =>
  field.group ||
  (["image", "video"].includes(field.type)
    ? "media"
    : field.type === "checkbox"
      ? "publication"
      : ["textarea", "lines", "questions"].includes(field.type)
        ? "content"
        : "main");
const groupTitles = (person) => ({
  main: person
    ? ["Coordonnées et suivi", "Identité, formation souhaitée et statut de la demande."]
    : ["Informations principales", "Les éléments qui identifient cette publication."],
  content: person
    ? ["Message", "Ce que la personne a écrit au centre."]
    : ["Contenu", "Le texte présenté aux visiteurs."],
  media: ["Médias", "Importez une image ou une vidéo depuis votre ordinateur."],
  publication: ["Publication", "Visibilité de cette publication sur le site."],
});
const switchHints = {
  published: "Visible par les visiteurs dès l’enregistrement.",
};

export default function ResourceEditor({
  resource,
  config,
  record,
  courses,
  onClose,
  onSaved,
  focusKey,
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        field.type === "password"
          ? ""
          : (record?.[field.key] ??
            field.default ??
            (field.type === "checkbox"
              ? false
              : field.type === "questions"
                ? []
                : field.type === "lines"
                  ? []
                  : field.options?.[0]?.[0] || "")),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mediaStatus, setMediaStatus] = useState({});
  const mediaSaved = useRef(false);
  function set(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }
  // Publication existante : l’image ou la vidéo importée (ou retirée) est
  // enregistrée tout de suite, sans attendre « Enregistrer ».
  async function changeMedia(key, value) {
    set(key, value);
    if (!record?._id) return;
    setMediaStatus((previous) => ({ ...previous, [key]: "saving" }));
    try {
      await adminApi(`/resources/${resource}/${record._id}`, {
        method: "PATCH",
        body: { [key]: value },
      });
      mediaSaved.current = true;
      setMediaStatus((previous) => ({ ...previous, [key]: "saved" }));
    } catch (failure) {
      setMediaStatus((previous) => ({ ...previous, [key]: "" }));
      setError(failure.message);
    }
  }
  // Après un enregistrement automatique, la liste est rafraîchie à la fermeture.
  const close = () => (mediaSaved.current ? onSaved() : onClose());
  // Ouvert depuis « Importer » dans la fiche : on va droit au champ concerné.
  useEffect(() => {
    if (focusKey)
      document
        .getElementById(`editor-field-${focusKey}`)
        ?.scrollIntoView({ block: "center" });
  }, [focusKey]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = { ...values };
    for (const field of config.fields)
      if (field.type === "lines" && typeof body[field.key] === "string")
        body[field.key] = body[field.key]
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
    if ("password" in body && !body.password) delete body.password;
    try {
      await adminApi(
        `/resources/${resource}${record ? `/${record._id}` : ""}`,
        { method: record ? "PATCH" : "POST", body },
      );
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  function renderField(field) {
    if (field.type === "questions")
      return (
        <div key={field.key} className="admin-full">
          <QuestionsEditor
            value={values[field.key]}
            onChange={(value) => set(field.key, value)}
          />
        </div>
      );
    if (field.type === "image" || field.type === "video")
      return (
        <div
          key={field.key}
          id={`editor-field-${field.key}`}
          className="admin-full"
        >
          <ImageUpload
            label={field.label}
            media={field.type}
            value={values[field.key]}
            onChange={(value) => changeMedia(field.key, value)}
            onBusyChange={setUploading}
          />
          {mediaStatus[field.key] === "saving" && (
            <small className="editor-media-status">Enregistrement…</small>
          )}
          {mediaStatus[field.key] === "saved" && (
            <small className="editor-media-status is-saved" role="status">
              <CircleCheck size={15} />
              {`${field.type === "video" ? "Vidéo" : "Image"} ${values[field.key] ? "enregistrée" : "retirée"}. `}
              {record.published
                ? "Le site public est déjà à jour."
                : "Activez « Publier sur le site » puis enregistrez pour la montrer aux visiteurs."}
            </small>
          )}
          {!record?._id && values[field.key] && (
            <small className="editor-media-status">
              Sera enregistrée avec la publication quand vous cliquerez sur
              « Enregistrer ».
            </small>
          )}
          {field.hint && <small className="editor-hint">{field.hint}</small>}
        </div>
      );
    if (field.type === "checkbox")
      return (
        <label key={field.key} className="admin-switch admin-full">
          <input
            type="checkbox"
            role="switch"
            checked={!!values[field.key]}
            onChange={(event) => set(field.key, event.target.checked)}
          />
          <span className="admin-switch-track" aria-hidden="true" />
          <span className="admin-switch-text">
            <strong>{field.label}</strong>
            {(field.hint || switchHints[field.key]) && (
              <small>{field.hint || switchHints[field.key]}</small>
            )}
          </span>
        </label>
      );
    const wide = ["textarea", "lines"].includes(field.type);
    return (
      <label className={wide ? "admin-full" : ""} key={field.key}>
        <span className="editor-label">
          {field.label}
          {field.required && <em>*</em>}
        </span>
        {wide ? (
          <textarea
            rows={field.key === "body" ? 6 : field.type === "lines" ? 5 : 3}
            value={
              Array.isArray(values[field.key])
                ? values[field.key].join("\n")
                : values[field.key]
            }
            maxLength={field.key === "body" ? 15000 : 3000}
            onChange={(event) => set(field.key, event.target.value)}
          />
        ) : ["select", "course"].includes(field.type) ? (
          <select
            value={values[field.key]}
            onChange={(event) => set(field.key, event.target.value)}
          >
            {field.type === "course" ? (
              <>
                <option value="">Non précisé</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </>
            ) : (
              field.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))
            )}
          </select>
        ) : (
          <input
            type={field.type}
            value={values[field.key]}
            required={field.required}
            minLength={
              field.type === "password" && values[field.key] ? 12 : undefined
            }
            maxLength={
              field.key === "imageUrl"
                ? 1000
                : field.type === "password"
                  ? 128
                  : 254
            }
            {...(field.type === "number" ? { min: 0, max: 99 } : {})}
            onChange={(event) => set(field.key, event.target.value)}
          />
        )}
        {field.hint && <small>{field.hint}</small>}
      </label>
    );
  }
  const titles = groupTitles(config.person);
  const sections = ["main", "content", "media", "publication"]
    .map((id) => ({
      id,
      fields: config.fields.filter((field) => groupOf(field) === id),
    }))
    .filter((section) => section.fields.length);
  // Limites rappelées sous « Médias », selon les champs présents.
  const mediaLimits = (fields) =>
    [
      fields.some((field) => field.type === "image") && "Image : 10 Mo maximum.",
      fields.some((field) => field.type === "video") && "Vidéo : 60 Mo maximum.",
    ].filter(Boolean);
  const renderSection = ({ id, fields }) => (
    <section key={id} className={`editor-section editor-section-${id}`}>
      <header>
        <h3>{titles[id][0]}</h3>
        <p>{titles[id][1]}</p>
        {id === "media" && (
          <ul className="editor-limits">
            {mediaLimits(fields).map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        )}
      </header>
      <div className="admin-form-grid">{fields.map(renderField)}</div>
    </section>
  );
  const main = sections.filter(({ id }) => id === "main" || id === "content");
  const side = sections.filter(
    ({ id }) => id === "media" || id === "publication",
  );
  return (
    <Dialog
      title={`${record ? "Modifier" : "Ajouter"} · ${config.title}`}
      onClose={close}
      className={side.length ? "admin-editor admin-editor-wide" : "admin-editor"}
    >
      {config.description && (
        <p className="editor-intro">{config.description}</p>
      )}
      <form className="admin-form" onSubmit={submit}>
        <div
          className={side.length ? "editor-layout has-side" : "editor-layout"}
        >
          <div className="editor-main">{main.map(renderSection)}</div>
          {side.length > 0 && (
            <aside className="editor-side">{side.map(renderSection)}</aside>
          )}
        </div>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        <div className="admin-editor-actions">
          {"published" in values && (
            <span
              className={
                values.published ? "editor-state is-live" : "editor-state"
              }
            >
              {values.published
                ? "Sera visible sur le site"
                : "Brouillon : non visible"}
            </span>
          )}
          <button
            type="button"
            className="button button-outline"
            onClick={close}
          >
            Annuler
          </button>
          <button
            className="button"
            disabled={
              busy ||
              uploading ||
              Object.values(mediaStatus).includes("saving") ||
              (resource === "assessments" && !values.questions?.length)
            }
          >
            <Save size={16} />
            {busy
              ? "Enregistrement…"
              : uploading
                ? "Import en cours…"
                : "Enregistrer"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
