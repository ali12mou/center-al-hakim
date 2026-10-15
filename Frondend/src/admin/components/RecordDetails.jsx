import Dialog from "../../components/Dialog.jsx";
import { dateLabel, statusLabels } from "../config/sections.js";

export default function RecordDetails({ record, config, onClose }) {
  return (
    <Dialog title={record.name || record.title} onClose={onClose}>
      <dl className="record-details">
        <div>
          <dt>Identifiant</dt>
          <dd>{record.reference || record.id || record._id}</dd>
        </div>
        <div>
          <dt>Date de création</dt>
          <dd>{dateLabel(record.createdAt)}</dd>
        </div>
        {config.fields
          .filter((field) => field.type !== "password")
          .map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>
                {field.key === "courseId"
                  ? record.courseTitle || record.courseId || "—"
                  : field.key === "status"
                    ? statusLabels[record.status]
                    : field.key === "questions"
                      ? `${record.questions?.length || 0} questions`
                      : typeof record[field.key] === "boolean"
                        ? record[field.key]
                          ? "Oui"
                          : "Non"
                        : Array.isArray(record[field.key])
                          ? record[field.key].join(" · ")
                          : record[field.key] || "—"}
              </dd>
            </div>
          ))}
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
    </Dialog>
  );
}
