import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { MapPin, Phone, Mail, ArrowUpRight, Menu, X, ShieldCheck } from "lucide-react";
import Brand from "./Brand.jsx";
import { useLanguage } from '../context/LanguageContext.jsx';

// Chaque entrée du menu est une page : l’onglet actif suit l’adresse affichée.
export default function Header({ centre, navigation }) {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <MapPin size={13} /> {t('Votre centre de formation à Djibouti')}
          </span>
          <div className="topbar-tools"><a href={`tel:${centre.phoneLink}`} dir="ltr">
            <Phone size={13} /> {centre.phone}
          </a>
          <a href={`mailto:${centre.email}`} className="topbar-email" dir="ltr" aria-label={centre.email} title={centre.email}>
            <Mail size={13} /> <span>{centre.email}</span>
          </a>
          <a href="/admin/login" className="admin-access" aria-label="Accès administrateur" title="Accès administrateur">
            <ShieldCheck size={16} /> <span>{t('Administration')}</span>
          </a>
          <div className="language-switch" role="group" aria-label="Langue du site">{[['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']].map(([code, label]) => <button type="button" key={code} aria-label={label} aria-pressed={language === code} className={language === code ? 'selected' : ''} onClick={() => setLanguage(code)}>{code.toUpperCase()}</button>)}</div></div>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <a
            href="/#accueil"
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
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) => (isActive ? "nav-active" : "")}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/inscription" className="button button-small header-cta">
            {t('Préinscription')} <ArrowUpRight size={16} />
          </Link>
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
