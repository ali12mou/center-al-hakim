import { useState } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";

export function EmptyPublications({
  label = "Les publications seront disponibles prochainement.",
}) {
  return (
    <div className="public-empty">
      <BookOpen size={31} />
      <h3>Chaque nouvelle étape commence ici.</h3>
      <p>{label}</p>
      <a href="/contact" className="text-link">
        Contactez le centre <ArrowUpRight size={16} />
      </a>
    </div>
  );
}
export default function PublicationCard({
  item,
  icon: Icon = BookOpen,
  onView,
  action = "En savoir plus",
}) {
  // Adresse qui n’est pas une image (page Pinterest, image supprimée…) : l’icône.
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className="publication-card">
      {item.imageUrl && !imageFailed ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="publication-icon">
          <Icon size={32} strokeWidth={1.5} />
        </span>
      )}
      <span className="publication-category">
        {item.category ||
          item.skill ||
          item.audience ||
          item.issuer ||
          "AL-HAKIM CENTER"}
      </span>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      {onView && (
        <button
          type="button"
          className="text-link"
          onClick={() => onView(item)}
        >
          {action} <ArrowUpRight size={16} />
        </button>
      )}
    </article>
  );
}
