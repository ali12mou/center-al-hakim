import { Award, Check } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { EmptyPublications } from "../components/PublicationCard.jsx";

export default function CertificationsPage() {
  const { data, error } = usePublicSite();
  const items = data?.portal?.certifications || [];
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="CERTIFICATIONS & ATTESTATIONS"
      title="Donnez de la visibilité à votre parcours."
      description="Découvrez les attestations envisagées et leurs conditions, précisées par le centre pour chaque programme."
    >
      <section className="section">
        <div className="container publication-grid">
          {items.map((item) => (
            <article
              className="publication-card certification-card"
              key={item._id}
            >
              <span className="publication-icon">
                <Award size={37} />
              </span>
              <span className="publication-category">{item.issuer}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <p className="publication-body">{item.body}</p>
              <ul className="check-list">
                {item.requirements?.map((text) => (
                  <li key={text}>
                    <Check size={15} />
                    {text}
                  </li>
                ))}
              </ul>
              <span className="certification-note">{item.accreditation}</span>
              <a href="/contact" className="text-link">
                Demander les modalités
              </a>
            </article>
          ))}
          {!items.length && <EmptyPublications />}
        </div>
      </section>
    </PublicPageLayout>
  );
}
