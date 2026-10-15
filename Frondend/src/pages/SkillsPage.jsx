import { useState } from "react";
import { GraduationCap } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import PublicationCard, {
  EmptyPublications,
} from "../components/PublicationCard.jsx";
import Dialog from "../components/Dialog.jsx";

export default function SkillsPage() {
  const { data, error } = usePublicSite();
  const [selected, setSelected] = useState(null);
  const items = data?.portal?.competences || [];
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="NOS COMPÉTENCES"
      title="Une compétence peut tout changer."
      description="Langues, outils numériques, management et finance : découvrez les domaines travaillés au centre."
    >
      <section className="section">
        <div className="container publication-grid">
          {items.map((item) => (
            <PublicationCard
              key={item._id}
              item={item}
              icon={GraduationCap}
              onView={setSelected}
            />
          ))}
          {!items.length && <EmptyPublications />}
        </div>
      </section>
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)}>
          <p>{selected.description}</p>
          <p className="publication-body">{selected.body}</p>
          <a className="button" href="/courses">
            Explorer les formations
          </a>
        </Dialog>
      )}
    </PublicPageLayout>
  );
}
