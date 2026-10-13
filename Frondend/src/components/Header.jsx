import { useState } from "react";
import { MapPin, Phone, ArrowUpRight, Menu, X } from "lucide-react";
import Brand from "./Brand.jsx";

export default function Header({ centre, navigation, active }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <MapPin size={13} /> Votre centre de formation à Djibouti
          </span>
          <a href={`tel:${centre.phoneLink}`}>
            <Phone size={13} /> {centre.phone}
          </a>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <a
            href="#accueil"
            className="brand-link"
            aria-label="AL-HAKIM CENTER, accueil"
            onClick={() => setOpen(false)}
          >
            <Brand />
          </a>
          <nav
            aria-label="Navigation principale"
            className={open ? "nav nav-open" : "nav"}
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={active === item.href.slice(1) ? "nav-active" : ""}
                aria-current={
                  active === item.href.slice(1) ? "location" : undefined
                }
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a href="#contact" className="button button-small header-cta">
            Préinscription <ArrowUpRight size={16} />
          </a>
          <button
            className="mobile-menu icon-button"
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
