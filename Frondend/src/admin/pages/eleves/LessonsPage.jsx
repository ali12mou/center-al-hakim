import { BookOpen, ExternalLink, FileText, Link2, Video } from "lucide-react";
import ListPage from "../../components/ListPage.jsx";
import { StatusPill } from "../../components/ui.jsx";
import { useLookup } from "../../hooks/useRemote.js";
import { fileUrl } from "../../services/adminApi.js";
import { dayLabel } from "../../lib/format.js";

export const LESSON_KINDS = {
  lesson: "Leçon (texte)",
  document: "Document (PDF ou image)",
  video: "Vidéo (lien YouTube, Drive…)",
  link: "Lien vers un site",
};
const ICONS = { lesson: BookOpen, document: FileText, video: Video, link: Link2 };

export const courseField = (extra = {}) => ({
  key: "courseId",
  label: "Formation",
  type: "lookup",
  lookup: "courses",
  valueKey: "id",
  required: true,
  ...extra,
});

export function useCourseOptions(allLabel = "Toutes les formations") {
  const courses = useLookup("courses");
  return [["", allLabel], ...courses.map((course) => [course.id, course.title])];
}
export function useCourseTitle() {
  const courses = useLookup("courses");
  return (id) => courses.find((course) => course.id === id)?.title || id || "—";
}

export default function LessonsPage() {
  const courseOptions = useCourseOptions();
  const courseTitle = useCourseTitle();
  return (
    <ListPage
      kicker="ESPACE STUDENTS · SUIVI PÉDAGOGIQUE"
      title="Cours et documents"
      description="Leçons, supports PDF, vidéos et liens publiés pour chaque formation. Les students inscrits à la formation les retrouvent dans l’onglet « Cours » de l’application."
      endpoint="/eleves/lessons"
      section="eleves.lessons"
      search="Titre ou description…"
      createLabel="Nouveau contenu"
      exportName="cours-eleves"
      filters={[
        { key: "courseId", label: "Formation", options: courseOptions },
        { key: "published", label: "Publication", options: [["", "Publiés et masqués"], ["true", "Publiés"], ["false", "Masqués"]] },
      ]}
      deleteConfirm={(item) => `Supprimer « ${item.title} » ? Les students ne le verront plus.`}
      columns={[
        {
          label: "Contenu",
          render: (item) => {
            const Icon = ICONS[item.kind] || BookOpen;
            return (
              <span className="lesson-cell">
                <Icon size={16} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{LESSON_KINDS[item.kind]}</small>
                </span>
              </span>
            );
          },
          csv: (item) => item.title,
        },
        { label: "Formation", render: (item) => courseTitle(item.courseId), csv: (item) => courseTitle(item.courseId) },
        { label: "Date", render: (item) => dayLabel(item.date), csv: (item) => item.date || "" },
        { label: "Ordre", align: "right", render: (item) => item.order, csv: (item) => item.order },
        {
          label: "Pièce jointe",
          render: (item) =>
            item.fileUrl ? (
              <a className="doc-link" href={fileUrl(item.fileUrl)} target="_blank" rel="noreferrer">
                <FileText size={15} /> Voir
              </a>
            ) : item.link ? (
              <a className="doc-link" href={item.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Lien
              </a>
            ) : (
              "—"
            ),
        },
        {
          label: "Statut",
          render: (item) => <StatusPill status={item.published ? "active" : "draft"} label={item.published ? "Publié" : "Masqué"} />,
          csv: (item) => (item.published ? "Publié" : "Masqué"),
        },
      ]}
      createDefaults={{ kind: "lesson", published: true, order: 0 }}
      form={{
        title: "contenu de cours",
        wide: true,
        fields: [
          courseField(),
          { key: "kind", label: "Type de contenu", type: "select", options: Object.entries(LESSON_KINDS) },
          { key: "title", label: "Titre", required: true, wide: true, max: 200 },
          { key: "description", label: "Résumé (affiché sous le titre)", type: "textarea", rows: 2, max: 2000 },
          {
            key: "body",
            label: "Contenu de la leçon",
            type: "textarea",
            rows: 8,
            max: 15000,
            hint: "Texte simple : les retours à la ligne sont conservés.",
            show: (values) => values.kind === "lesson",
          },
          {
            key: "fileUrl",
            label: "Document (PDF ou image, 10 Mo max.)",
            type: "file",
            show: (values) => ["document", "lesson"].includes(values.kind),
          },
          {
            key: "link",
            label: "Lien (https://…)",
            type: "url",
            max: 1000,
            wide: true,
            placeholder: "https://",
            show: (values) => ["video", "link"].includes(values.kind),
          },
          { key: "date", label: "Date de la séance", type: "date" },
          { key: "order", label: "Ordre d’affichage", type: "number", min: 0, hint: "Les plus petits nombres apparaissent en premier." },
          { key: "published", label: "Visible par les students", type: "checkbox", default: true },
        ],
      }}
    />
  );
}
