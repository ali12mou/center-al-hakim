import { Building2, Check, ArrowUpRight } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { EmptyPublications } from "../components/PublicationCard.jsx";

export default function BusinessesPage() {
  const { data, error } = usePublicSite();
  const items = data?.portal?.businesses || [];
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="BUSINESSES · ENTREPRISES"
      title="Investissez dans le potentiel de vos équipes."
      description="Des parcours adaptés aux entreprises, aux institutions et à leurs collaborateurs."
    >
      <section className="section">
        <div className="container publication-grid">
          {items.map((item) => (
            <article className="publication-card" key={item._id}>
              <span className="publication-icon">
                <Building2 size={33} />
              </span>
              <span className="publication-category">{item.audience}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <p className="publication-body">{item.body}</p>
              <ul className="check-list">
                {item.benefits?.map((benefit) => (
                  <li key={benefit}>
                    <Check size={15} />
                    {benefit}
                  </li>
                ))}
              </ul>
              <a href="/entreprises#contact" className="button">
                Parlons de vos besoins <ArrowUpRight size={17} />
              </a>
            </article>
          ))}
          {!items.length && <EmptyPublications />}
        </div>
      </section>
    </PublicPageLayout>
  );
}
