import { Info } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { EmptyPublications } from "../components/PublicationCard.jsx";

export default function InformationPage() {
  const { data, error } = usePublicSite();
  const items = data?.portal?.informations || [];
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="INFORMATIONS DU CENTRE"
      title="Les informations utiles, au même endroit."
      description="Retrouvez les communications publiées par AL-HAKIM CENTER."
    >
      <section className="section">
        <div className="container information-list">
          {items.map((item) => (
            <article key={item._id} id={`info-${item._id}`}>
              <Info size={26} />
              <div>
                <span className="eyebrow">{item.category}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <p className="publication-body">{item.body}</p>
              </div>
            </article>
          ))}
          {!items.length && <EmptyPublications />}
        </div>
      </section>
    </PublicPageLayout>
  );
}
