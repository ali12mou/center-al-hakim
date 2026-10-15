import { useState } from "react";
import { Save } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import QuestionsEditor from "./QuestionsEditor.jsx";
import { adminApi } from "../services/adminApi.js";

export default function ResourceEditor({
  resource,
  config,
  record,
  courses,
  onClose,
  onSaved,
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      config.fields.map((field) => [
        field.key,
        field.type === "password"
          ? ""
          : (record?.[field.key] ??
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
  const [error, setError] = useState("");
  function set(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }
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
  return (
    <Dialog
      title={`${record ? "Modifier" : "Ajouter"} · ${config.title}`}
      onClose={onClose}
      className="admin-editor"
    >
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-form-grid">
          {config.fields.map((field) => {
            if (field.type === "questions")
              return (
                <div key={field.key} className="admin-full">
                  <QuestionsEditor
                    value={values[field.key]}
                    onChange={(value) => set(field.key, value)}
                  />
                </div>
              );
            if (field.type === "checkbox")
              return (
                <label key={field.key} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={!!values[field.key]}
                    onChange={(event) => set(field.key, event.target.checked)}
                  />
                  {field.label}
                </label>
              );
            const wide = ["textarea", "lines"].includes(field.type);
            return (
              <label className={wide ? "admin-full" : ""} key={field.key}>
                {field.label}
                {field.required && <em>*</em>}
                {wide ? (
                  <textarea
                    rows={field.key === "body" ? 6 : 3}
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
                      field.type === "password" && values[field.key]
                        ? 12
                        : undefined
                    }
                    maxLength={
                      field.key === "imageUrl"
                        ? 1000
                        : field.type === "password"
                          ? 128
                          : 254
                    }
                    onChange={(event) => set(field.key, event.target.value)}
                  />
                )}
                {field.hint && <small>{field.hint}</small>}
              </label>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        <div className="admin-editor-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="button"
            disabled={
              busy || (resource === "assessments" && !values.questions?.length)
            }
          >
            <Save size={16} />
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
