import { useRef, useState } from "react";
import { FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { adminApi, fileUrl } from "../services/adminApi.js";

const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX = 10 * 1024 * 1024;

// Justificatif ou document du personnel : PDF ou image, stocké en privé.
export default function FileField({ value, onChange, onBusyChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("Choisissez un PDF ou une image (PNG, JPG, WebP, GIF).");
    if (file.size > MAX) return setError("Fichier trop lourd : 10 Mo maximum.");
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    try {
      const { url } = await adminApi("/files", { method: "POST", file });
      onChange(url);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="file-field">
      {value ? (
        <span className="file-chip">
          <FileText size={16} />
          <a href={fileUrl(value)} target="_blank" rel="noreferrer">
            {value.endsWith(".pdf") ? "Document PDF joint" : "Image jointe"}
          </a>
          <button type="button" onClick={() => onChange("")} aria-label="Retirer le fichier">
            <X size={15} />
          </button>
        </span>
      ) : (
        <button type="button" className="file-pick" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Paperclip size={16} />}
          {busy ? "Envoi en cours…" : "Joindre un fichier (PDF ou image, 10 Mo max.)"}
        </button>
      )}
      <input ref={input} type="file" accept={TYPES.join(",")} hidden onChange={pick} />
      {error && <small className="file-error">{error}</small>}
    </div>
  );
}
