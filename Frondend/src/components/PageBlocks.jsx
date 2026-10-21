import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

const MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=Balbala+Avenue+principale+Arta+GAX+Assurance+Djibouti";

// Coordonnées pratiques du centre, reprises sur la page Le centre.
export function PracticalInfo({ centre }) {
  const items = [
    {
      icon: MapPin,
      label: "Adresse",
      value: centre.address,
      note: centre.landmark,
      href: MAP_URL,
      action: "Ouvrir le plan",
    },
    {
      icon: Phone,
      label: "Téléphone",
      value: centre.phone,
      href: `tel:${centre.phoneLink}`,
      action: "Appeler le centre",
    },
    {
      icon: Mail,
      label: "E-mail",
      value: centre.email,
      href: `mailto:${centre.email}`,
      action: "Écrire un e-mail",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: centre.phone,
      href: `https://wa.me/${centre.whatsapp}`,
      action: "Discuter sur WhatsApp",
    },
  ];
  return (
    <section id="nous-trouver" className="section practical">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NOUS TROUVER</span>
            <h2>Un centre de proximité, à Balbala.</h2>
            <p>Passez nous voir ou contactez-nous : nous vous orientons.</p>
          </div>
        </div>
        <div className="practical-grid">
          {items.map(({ icon: Icon, label, value, note, href, action }) => (
            <a
              key={label}
              className="practical-card"
              href={href}
              {...(href.startsWith("http")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              <span className="contact-icon">
                <Icon size={21} />
              </span>
              <small>{label}</small>
              <strong dir={label === "Adresse" ? undefined : "ltr"}>
                {value}
              </strong>
              {note && <span className="practical-note">{note}</span>}
              <span className="practical-action">
                {action} <ArrowUpRight size={15} />
              </span>
            </a>
          ))}
        </div>
        <p className="practical-hours">
          <Clock3 size={15} /> Les dates et horaires des sessions sont confirmés
          avec le centre.
        </p>
      </div>
    </section>
  );
}

// Bandeau de fin de page : une action principale, une action secondaire.
export function PageCta({ eyebrow, title, text, primary, secondary }) {
  return (
    <section className="page-cta">
      <div className="container page-cta-inner">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="page-cta-actions">
          <Link className="button button-white" to={primary.to}>
            {primary.label} <ArrowUpRight size={18} />
          </Link>
          {secondary && (
            <Link className="text-link" to={secondary.to}>
              {secondary.label} <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
