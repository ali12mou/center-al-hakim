import { useRef, useState } from "react";
import { ImagePlus, Link2, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { adminApi } from "../services/adminApi.js";

// Mêmes limites que le Backend : vérifiées ici pour répondre tout de suite.
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;

export default function ImageUpload({ label, value, onChange, onBusyChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(Boolean(value) && !value.startsWith("/uploads/"));
  const [broken, setBroken] = useState(false);
  function setWorking(state) {
    setBusy(state);
    onBusyChange?.(state);
  }
  async function upload(file) {
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type))
      return setError("Format non accepté : choisissez une image PNG, JPG, WebP ou GIF.");
    if (file.size > MAX) return setError("Image trop lourde : 5 Mo maximum.");
    setWorking(true);
    try {
      const { url } = await adminApi("/uploads", { method: "POST", file });
      setBroken(false);
      onChange(url);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  }
  const choose = () => input.current?.click();
  return (
    <div className="admin-full image-field">
      <span className="image-field-label">{label}</span>
      <div
        className={[
          "image-drop",
          dragging ? "is-dragging" : "",
          value && !broken ? "has-image" : "",
        ].join(" ")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          upload(event.dataTransfer.files[0]);
        }}
      >
        {value && !broken ? (
          <>
            <img src={value} alt="Aperçu de l’image" onError={() => setBroken(true)} />
            <div className="image-drop-actions">
              <button type="button" onClick={choose} disabled={busy}>
                <ImagePlus size={16} />
                Remplacer
              </button>
              <button type="button" onClick={() => onChange("")} disabled={busy}>
                <Trash2 size={16} />
                Retirer
              </button>
            </div>
            {busy && (
              <span className="image-drop-busy">
                <LoaderCircle size={26} className="spin" />
              </span>
            )}
          </>
        ) : (
          <button type="button" className="image-drop-empty" onClick={choose} disabled={busy}>
            {busy ? (
              <LoaderCircle size={28} className="spin" />
            ) : (
              <UploadCloud size={28} />
            )}
            <strong>{busy ? "Import en cours…" : "Importer une image"}</strong>
            <small>Cliquez ou glissez-déposez · PNG, JPG, WebP, GIF · 5 Mo max.</small>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          hidden
          onChange={(event) => upload(event.target.files[0])}
        />
      </div>
      {broken && value && (
        <small className="image-field-error" role="alert">
          Cette adresse n’affiche pas d’image (une page web n’est pas une image).
          Importez plutôt le fichier.
        </small>
      )}
      {error && (
        <small className="image-field-error" role="alert">
          {error}
        </small>
      )}
      <button
        type="button"
        className="image-url-toggle"
        onClick={() => setShowUrl(!showUrl)}
      >
        <Link2 size={14} />
        {showUrl ? "Masquer l’adresse web" : "Ou utiliser une adresse web"}
      </button>
      {showUrl && (
        <input
          className="image-url-input"
          value={value}
          maxLength={1000}
          placeholder="https://exemple.com/photo.jpg"
          aria-label="Adresse web de l’image"
          onChange={(event) => {
            setBroken(false);
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}
