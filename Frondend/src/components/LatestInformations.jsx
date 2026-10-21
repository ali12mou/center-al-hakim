import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Info } from "lucide-react";

// Les informations publiées depuis l’administration (les plus récentes d’abord)
// apparaissent sur l’accueil ; la page /informations les présente en entier.
const SHOWN = 3;

function Cover({ src }) {
  const [failed, setFailed] = useState(false);
  // Un lien qui n’est pas une image (page web, image supprimée) laisse l’icône.
  if (!src || failed)
    return (
      <span className="publication-icon">
        <Info size={30} strokeWidth={1.6} />
      </span>
    );
  return (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function LatestInformations({ items = [] }) {
  if (!items.length) return null;
  return (
    <section id="informations" className="section home-informations">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INFORMATIONS DU CENTRE</span>
            <h2>Les dernières nouvelles du centre.</h2>
            <p>Annonces et informations utiles publiées par AL-HAKIM CENTER.</p>
          </div>
          <Link className="text-link" to="/informations">
            Toutes les informations ({items.length})
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="publication-grid">
          {items.slice(0, SHOWN).map((item) => (
            <article className="publication-card" key={item._id}>
              <Cover src={item.imageUrl} />
              <span className="publication-category">
                {item.category}
                {item.createdAt && (
                  <time dateTime={item.createdAt}>
                    {" · "}
                    {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                )}
              </span>
              <h3>{item.title}</h3>
              <p className="information-excerpt">
                {item.description || item.body}
              </p>
              <Link
                className="text-link"
                to={`/informations#info-${item._id}`}
              >
                Lire l’information <ArrowUpRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
