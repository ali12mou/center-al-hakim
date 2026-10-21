import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import PublicNav from "./PublicNav.jsx";
import LogoLoader from "./LogoLoader.jsx";
import { getSiteData } from "../services/api.js";
import { useLanguage } from '../context/LanguageContext.jsx';

export function usePublicSite() {
  const { language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    getSiteData(language)
      .then((value) => {
        if (live) setData(value);
      })
      .catch((failure) => {
        if (live) setError(failure.message);
      });
    return () => {
      live = false;
    };
  }, [language]);
  return { data, error };
}
// Image de fond du premier bloc, choisie selon le sujet de chaque page.
const pageImages = {
  "/formations": "/images/hero-classroom.jpg",
  "/courses": "/images/hero-classroom.jpg",
  "/inscription": "/images/hero-classroom.jpg",
  "/centre": "/images/centre.jpg",
  "/informations": "/images/centre.jpg",
  "/certifications": "/images/centre.jpg",
  "/entreprises": "/images/management.jpg",
  "/businesses": "/images/management.jpg",
  "/competences": "/images/informatique.jpg",
  "/skill-assessment": "/images/finance.jpg",
  "/contact": "/images/langues.jpg",
  "/blog": "/images/langues.jpg",
};

export default function PublicPageLayout({
  data,
  error,
  title,
  eyebrow,
  description,
  image,
  children,
}) {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  // /blog/mon-article reprend l’image de /blog.
  const background =
    image || pageImages[pathname] || pageImages[`/${pathname.split("/")[1]}`];
  const ready = Boolean(data);
  // Une adresse comme /entreprises#contact vise un bloc qui n’existe qu’une
  // fois les données chargées : on s’y rend à ce moment-là.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (ready && id)
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, [ready]);
  if (error)
    return (
      <main className="loading-screen">
        <h1>AL-HAKIM CENTER</h1>
        <p role="alert">{error}</p>
        <a href="/" className="button">
          Retour à l’accueil
        </a>
      </main>
    );
  if (!data)
    return (
      <main className="loading-screen" aria-busy="true">
        <LogoLoader label="Chargement du centre…" />
      </main>
    );
  const privacy = () => window.location.assign("/?confidentialite=1#contact");
  return (
    <>
      <Header centre={data.centre} navigation={data.content.navigation} />
      <PublicNav />
      <main id="contenu">
        <div className={background ? "page-intro has-image" : "page-intro"}>
          {background && (
            <img
              className="page-intro-image"
              src={background}
              alt=""
              fetchPriority="high"
            />
          )}
          <div className="container">
            <div className="breadcrumb">
              <Link to="/">Accueil</Link>
              <span>/</span>
              <span>{eyebrow || title}</span>
            </div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{t(title)}</h1>
            <p>{t(description)}</p>
          </div>
        </div>
        {children}
      </main>
      <Footer
        centre={data.centre}
        departments={data.departments}
        onPrivacy={privacy}
        onLegal={() => window.location.assign("/?informations=1")}
      />
    </>
  );
}
