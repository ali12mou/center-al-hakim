import { ImagePlus, Pencil, Video } from "lucide-react";
import Dialog from "../../components/Dialog.jsx";
import { dateLabel, statusLabels } from "../config/sections.js";

// Valeur lisible d’un champ : libellé d’une liste, Oui/Non, liste à puces…
function displayValue(field, record) {
  const value = record[field.key];
  if (field.key === "courseId")
    return record.courseTitle || record.courseId || "—";
  if (field.key === "status") return statusLabels[record.status] || "—";
  if (field.key === "questions")
    return `${record.questions?.length || 0} questions`;
  if (field.type === "checkbox") return value ? "Oui" : "Non";
  if (field.options)
    return field.options.find(([option]) => option === value)?.[1] || value || "—";
  if (Array.isArray(value)) return value.length ? value.join(" · ") : "—";
  return value || value === 0 ? value : "—";
}

export default function RecordDetails({ record, config, onClose, onEdit }) {
  const fields = config.fields.filter((field) => field.type !== "password");
  return (
    <Dialog
      title={record.name || record.title}
      onClose={onClose}
      className="admin-details"
    >
      <dl className="record-details">
        <div>
          <dt>Identifiant</dt>
          <dd>{record.reference || record.id || record._id}</dd>
        </div>
        <div>
          <dt>Date de création</dt>
          <dd>{dateLabel(record.createdAt)}</dd>
        </div>
        {fields.map((field) => {
          const media = field.type === "image" || field.type === "video";
          const wide =
            media || ["textarea", "lines", "questions"].includes(field.type);
          return (
            <div key={field.key} className={wide ? "is-wide" : ""}>
              <dt>{field.label}</dt>
              <dd>
                {media && record[field.key] ? (
                  field.type === "video" ? (
                    <video
                      className="record-media"
                      src={record[field.key]}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      className="record-media"
                      src={record[field.key]}
                      alt={field.label}
                    />
                  )
                ) : media ? (
                  // Champ média vide : import direct depuis la fiche.
                  onEdit ? (
                    <button
                      type="button"
                      className="record-media-empty"
                      onClick={() => onEdit(field.key)}
                    >
                      {field.type === "video" ? (
                        <Video size={20} />
                      ) : (
                        <ImagePlus size={20} />
                      )}
                      {field.type === "video"
                        ? "Importer une vidéo"
                        : "Importer une image"}
                    </button>
                  ) : (
                    "—"
                  )
                ) : (
                  displayValue(field, record)
                )}
              </dd>
            </div>
          );
        })}
        {config.person && (
          <div>
            <dt>Mot de passe</dt>
            <dd>
              {record.hasPassword
                ? "Défini — protégé et non affichable"
                : "Non défini"}
            </dd>
          </div>
        )}
      </dl>
      {onEdit && (
        <div className="record-details-actions">
          <button type="button" className="button button-outline" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="button" onClick={() => onEdit()}>
            <Pencil size={16} /> Modifier
          </button>
        </div>
      )}
    </Dialog>
  );
}
