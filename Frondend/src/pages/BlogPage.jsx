import { Link, useParams } from "react-router-dom";
import { Newspaper, ArrowUpRight } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import { EmptyPublications } from "../components/PublicationCard.jsx";

export default function BlogPage() {
  const { data, error } = usePublicSite();
  const { id } = useParams();
  const items = data?.portal?.blog || [];
  const selected = id && items.find((item) => item._id === id);
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="LE BLOG DU CENTRE"
      title={selected?.title || "Des idées pour aller plus loin."}
      description={
        selected?.description ||
        "Actualités, conseils et informations publiés par le centre."
      }
    >
      <section className="section">
        <div className="container">
          {id ? (
            selected ? (
              <article className="blog-detail">
                {selected.imageUrl && <img src={selected.imageUrl} alt="" />}
                <span className="publication-category">
                  {selected.author} · {selected.category}
                </span>
                <p className="publication-body">{selected.body}</p>
                <Link className="text-link" to="/blog">
                  Retour au blog
                </Link>
              </article>
            ) : (
              <EmptyPublications label="Cet article est indisponible ou n’est plus publié." />
            )
          ) : (
            <div className="publication-grid">
              {items.map((item) => (
                <article className="publication-card" key={item._id}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <span className="publication-icon">
                      <Newspaper size={30} />
                    </span>
                  )}
                  <span className="publication-category">{item.category}</span>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <Link className="text-link" to={`/blog/${item._id}`}>
                    Lire l’article <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))}
              {!items.length && (
                <EmptyPublications label="Les actualités du centre seront publiées ici." />
              )}
            </div>
          )}
        </div>
      </section>
    </PublicPageLayout>
  );
}
