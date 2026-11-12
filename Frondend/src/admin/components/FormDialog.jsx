import { useState } from "react";
import { Save } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import FileField from "./FileField.jsx";
import { useLookup } from "../hooks/useRemote.js";
import { money, WEEKDAYS } from "../lib/format.js";

// Valeur de départ d’un champ : l’enregistrement, sinon le défaut du champ.
// Une référence peuplée ({ _id, fullName }) redevient son identifiant.
function initialValue(field, initial) {
  const raw = field.key.split(".").reduce((value, key) => value?.[key], initial);
  const value = raw && typeof raw === "object" && !Array.isArray(raw) && raw._id ? raw._id : raw;
  if (value !== undefined && value !== null) return value;
  if (field.default !== undefined) return typeof field.default === "function" ? field.default() : field.default;
  if (field.type === "checkbox") return false;
  if (["lines", "weekdays"].includes(field.type)) return [];
  if (field.type === "select") return field.options?.[0]?.[0] ?? "";
  return "";
}
const setPath = (target, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((node, key) => (node[key] ||= {}), target);
  parent[last] = value;
};

function LookupSelect({ field, value, onChange, values }) {
  const items = useLookup(field.lookup, typeof field.query === "function" ? field.query(values) : field.query);
  const list = field.filter ? items.filter((item) => field.filter(item, values)) : items;
  const valueOf = (item) => String(item[field.valueKey || "_id"]);
  const labelOf = field.optionLabel || ((item) => item.fullName || item.name || item.title || item.label);
  return (
    <select value={value || ""} required={field.required} onChange={(event) => onChange(event.target.value, list.find((item) => valueOf(item) === event.target.value))}>
      <option value="">{field.placeholder || "— Choisir —"}</option>
      {list.map((item) => (
        <option key={valueOf(item)} value={valueOf(item)}>
          {labelOf(item)}
        </option>
      ))}
    </select>
  );
}

function Weekdays({ value = [], onChange }) {
  // Semaine affichée du samedi au vendredi (usage à Djibouti).
  const order = [6, 0, 1, 2, 3, 4, 5];
  return (
    <div className="weekday-picker" role="group">
      {order.map((day) => {
        const active = value.includes(day);
        return (
          <button
            type="button"
            key={day}
            aria-pressed={active}
            className={active ? "active" : ""}
            onClick={() => onChange(active ? value.filter((item) => item !== day) : [...value, day].sort())}
          >
            {WEEKDAYS[day]}
          </button>
        );
      })}
    </div>
  );
}

export function FormFields({ fields, values, setValue, onBusyChange }) {
  return (
    <div className="admin-form-grid">
      {fields.map((field, index) => {
        if (field.show && !field.show(values)) return null;
        if (field.type === "heading")
          return (
            <h3 key={`${field.label}-${index}`} className="form-heading admin-full">
              {field.label}
              {field.hint && <small>{field.hint}</small>}
            </h3>
          );
        const value = values[field.key];
        const set = (next) => setValue(field.key, next);
        const wide = field.wide || ["textarea", "lines", "weekdays", "file", "custom"].includes(field.type);
        if (field.type === "checkbox")
          return (
            <label key={`${field.key}-${index}`} className="admin-switch admin-full">
              <input type="checkbox" role="switch" checked={!!value} onChange={(event) => set(event.target.checked)} />
              <span className="admin-switch-track" aria-hidden="true" />
              <span className="admin-switch-text">
                <strong>{field.label}</strong>
                {field.hint && <small>{field.hint}</small>}
              </span>
            </label>
          );
        let control;
        if (field.type === "custom") control = field.render({ value, set, values, setValue, onBusyChange });
        else if (field.type === "file") control = <FileField value={value} onChange={set} onBusyChange={onBusyChange} />;
        else if (field.type === "weekdays") control = <Weekdays value={value} onChange={set} />;
        else if (field.type === "lookup")
          control = (
            <LookupSelect
              field={field}
              value={value}
              values={values}
              onChange={(next, item) => {
                set(next);
                field.onPick?.(item, setValue, values);
              }}
            />
          );
        else if (field.type === "select")
          control = (
            <select value={value} required={field.required} onChange={(event) => set(event.target.value)}>
              {field.options.map(([option, label]) => (
                <option key={option} value={option}>
                  {label}
                </option>
              ))}
            </select>
          );
        else if (["textarea", "lines"].includes(field.type))
          control = (
            <textarea
              rows={field.rows || (field.type === "lines" ? 4 : 3)}
              value={Array.isArray(value) ? value.join("\n") : value}
              maxLength={field.max || 2000}
              onChange={(event) => set(event.target.value)}
            />
          );
        else
          control = (
            <input
              type={field.type === "money" ? "number" : field.type || "text"}
              value={value}
              required={field.required}
              min={field.type === "money" ? 0 : field.min}
              max={field.maxValue}
              step={field.type === "money" ? 1 : field.step}
              placeholder={field.placeholder || (field.type === "month" ? "AAAA-MM" : undefined)}
              maxLength={["text", "email", "tel", undefined].includes(field.type) ? field.max || 200 : undefined}
              onChange={(event) => set(event.target.value)}
            />
          );
        return (
          <label key={`${field.key}-${index}`} className={wide ? "admin-full" : ""}>
            <span className="editor-label">
              {field.label}
              {field.required && <em>*</em>}
            </span>
            {control}
            {field.type === "money" && value !== "" && Number(value) > 0 && <small>{money(value)}</small>}
            {field.hint && <small>{typeof field.hint === "function" ? field.hint(values) : field.hint}</small>}
          </label>
        );
      })}
    </div>
  );
}

// Les champs affichés, convertis pour l’API (nombres, listes, cases).
export function collect(fields, values) {
  const body = {};
  for (const field of fields) {
    if (field.type === "heading" || field.virtual) continue;
    if (field.show && !field.show(values)) continue;
    let value = values[field.key];
    if (field.type === "lines")
      value = (Array.isArray(value) ? value : String(value || "").split("\n")).map((line) => line.trim()).filter(Boolean);
    else if (["number", "money"].includes(field.type)) value = value === "" || value === null ? undefined : Number(value);
    else if (typeof value === "string") value = value.trim();
    if (value !== undefined) setPath(body, field.key, value);
  }
  return body;
}

export default function FormDialog({
  title,
  intro,
  fields,
  initial = {},
  onSubmit,
  onClose,
  submitLabel = "Enregistrer",
  wide = false,
  children,
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.filter((field) => field.key).map((field) => [field.key, initialValue(field, initial)])),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(collect(fields, values), values);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose} className={`admin-editor form-dialog ${wide ? "admin-editor-wide" : ""}`}>
      {intro && <p className="editor-intro">{intro}</p>}
      <form className="admin-form" onSubmit={submit}>
        <FormFields fields={fields} values={values} setValue={setValue} onBusyChange={setUploading} />
        {typeof children === "function" ? children(values) : children}
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        <div className="admin-editor-actions">
          <button type="button" className="button button-outline" onClick={onClose}>
            Annuler
          </button>
          <button className="button" disabled={busy || uploading}>
            <Save size={16} />
            {busy ? "Enregistrement…" : uploading ? "Envoi du fichier…" : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
