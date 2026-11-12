import { Pin } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { StatusPill } from "../../components/ui.jsx";
import { dayLabel, today } from "../../lib/format.js";
import { courseField, useCourseOptions, useCourseTitle } from "./LessonsPage.jsx";

export default function AnnouncementsPage() {
  const courseOptions = useCourseOptions("Toutes les annonces");
  const courseTitle = useCourseTitle();
  return (
    <ListPage
      kicker="ESPACE STUDENTS · COMMUNICATION"
      title="Annonces aux students"
      description="Messages affichés dans l’application : changement d’horaire, examen, fermeture, événement… Choisissez une formation ou laissez « Tous les students »."
      endpoint="/eleves/announcements"
      section="eleves.announcements"
      search="Titre ou texte…"
      createLabel="Nouvelle annonce"
      filters={[
        { key: "courseId", label: "Formation", options: courseOptions },
        { key: "from", label: "Du" },
        { key: "to", label: "Au" },
      ]}
      deleteConfirm={(item) => `Supprimer l’annonce « ${item.title} » ?`}
      columns={[
        {
          label: "Annonce",
          render: (item) => (
            <span className="lesson-cell">
              {item.pinned && <Pin size={15} aria-label="Épinglée" />}
              <span>
                <strong>{item.title}</strong>
                {item.body && <small>{item.body.slice(0, 90)}{item.body.length > 90 ? "…" : ""}</small>}
              </span>
            </span>
          ),
        },
        { label: "Destinataires", render: (item) => (item.courseId ? courseTitle(item.courseId) : "Tous les students") },
        { label: "Date", render: (item) => dayLabel(item.date) },
        {
          label: "Statut",
          render: (item) => <StatusPill status={item.published ? "active" : "draft"} label={item.published ? "Publiée" : "Brouillon"} />,
        },
      ]}
      createDefaults={{ date: today(), published: true, pinned: false, courseId: "" }}
      form={{
        title: "annonce",
        wide: true,
        fields: [
          { key: "title", label: "Titre", required: true, wide: true, max: 200 },
          { key: "body", label: "Message", type: "textarea", rows: 6, max: 5000 },
          courseField({ label: "Destinataires", required: false, placeholder: "— Tous les students —" }),
          { key: "date", label: "Date", type: "date", required: true, default: today },
          { key: "pinned", label: "Épingler en haut de la liste", type: "checkbox" },
          { key: "published", label: "Visible par les students", type: "checkbox", default: true },
        ],
      }}
    />
  );
}
