import { useRef, useState } from "react";
import { ImagePlus, Link2, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { adminApi } from "../services/adminApi.js";

// Mêmes limites que le Backend : vérifiées ici pour répondre tout de suite.
const kinds = {
  image: {
    types: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    max: 5 * 1024 * 1024,
    formats: "PNG, JPG, WebP, GIF · 5 Mo max.",
    wrongType: "Format non accepté : choisissez une image PNG, JPG, WebP ou GIF.",
    tooBig: "Image trop lourde : 5 Mo maximum.",
    importLabel: "Importer une image",
    preview: "Aperçu de l’image",
    placeholder: "https://exemple.com/photo.jpg",
    urlLabel: "Adresse web de l’image",
    broken:
      "Cette adresse n’affiche pas d’image (une page web n’est pas une image). Importez plutôt le fichier.",
  },
  video: {
    types: ["video/mp4", "video/webm"],
    max: 30 * 1024 * 1024,
    formats: "MP4, WebM · 30 Mo max.",
    wrongType: "Format non accepté : choisissez une vidéo MP4 ou WebM.",
    tooBig: "Vidéo trop lourde : 30 Mo maximum.",
    importLabel: "Importer une vidéo",
    preview: "Aperçu de la vidéo",
    placeholder: "https://exemple.com/video.mp4",
    urlLabel: "Adresse web de la vidéo",
    broken:
      "Cette adresse ne lit pas de vidéo (une page YouTube n’est pas un fichier vidéo). Importez plutôt le fichier MP4 ou WebM.",
  },
};

export default function ImageUpload({
  label,
  value,
  onChange,
  onBusyChange,
  media = "image",
}) {
  const kind = kinds[media];
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
    if (!kind.types.includes(file.type)) return setError(kind.wrongType);
    if (file.size > kind.max) return setError(kind.tooBig);
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
            {media === "video" ? (
              <video
                src={value}
                aria-label={kind.preview}
                muted
                playsInline
                controls
                preload="metadata"
                onError={() => setBroken(true)}
              />
            ) : (
              <img src={value} alt={kind.preview} onError={() => setBroken(true)} />
            )}
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
            <strong>{busy ? "Import en cours…" : kind.importLabel}</strong>
            <small>Cliquez ou glissez-déposez · {kind.formats}</small>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={kind.types.join(",")}
          hidden
          onChange={(event) => upload(event.target.files[0])}
        />
      </div>
      {broken && value && (
        <small className="image-field-error" role="alert">
          {kind.broken}
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
          placeholder={kind.placeholder}
          aria-label={kind.urlLabel}
          onChange={(event) => {
            setBroken(false);
            onChange(event.target.value);
          }}
        />
      )}
    </div>
  );
}
