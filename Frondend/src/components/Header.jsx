import { useState } from "react";
import { MapPin, Phone, ArrowUpRight, Menu, X, ShieldCheck } from "lucide-react";
import Brand from "./Brand.jsx";
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Header({ centre, navigation, active }) {
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
              <a
                key={item.href}
                href={item.href.startsWith("#") ? `/${item.href}` : item.href}
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
          <a href="/inscription" className="button button-small header-cta">
            {t('Préinscription')} <ArrowUpRight size={16} />
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
