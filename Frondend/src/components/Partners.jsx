import { ArrowUpRight } from "lucide-react";

export default function Partners({ items = [] }) {
  if (!items.length) return null;
  return (
    <section id="partenaires" className="section partners-section">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">APPRENDRE DANS UN MONDE CONNECTÉ</span>
            <h2>Nos partenaires & notre écosystème.</h2>
            <p>
              Des outils et des collaborations pour accompagner l’apprentissage.
            </p>
          </div>
        </div>
        <div className="partners-grid">
          {items.map((item) => (
            <article key={item._id} className="partner-card">
              {item.title.toLowerCase() === "microsoft" ? (
                <div className="microsoft-brand">
                  <span className="microsoft-squares">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>Microsoft</strong>
                </div>
              ) : item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} />
              ) : (
                <h3>{item.title}</h3>
              )}
              <span className="partner-status">
                {item.relationship === "partner"
                  ? "Partenaire"
                  : item.relationship === "pending"
                    ? "Collaboration à confirmer"
                    : "Écosystème technologique"}
              </span>
              <p>{item.description}</p>
              {item.website && (
                <a
                  href={item.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  Découvrir <ArrowUpRight size={14} />
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
