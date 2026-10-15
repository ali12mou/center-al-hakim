import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { getSiteData } from "./services/api.js";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Dialog from "./components/Dialog.jsx";
import CourseDialog from "./components/CourseDialog.jsx";
import Faq from "./components/Faq.jsx";
import Home from "./pages/Home.jsx";
import Formations from "./pages/Formations.jsx";
import Centre from "./pages/Centre.jsx";
import Entreprises from "./pages/Entreprises.jsx";
import Contact from "./pages/Contact.jsx";
import PublicNav from "./components/PublicNav.jsx";
import Partners from "./components/Partners.jsx";
import { useLanguage } from './context/LanguageContext.jsx';

export default function LandingSite() {
  const { language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState("accueil");
  const [course, setCourse] = useState(null);
  const [information, setInformation] = useState(() =>
    new URLSearchParams(window.location.search).has("confidentialite")
      ? "privacy"
      : new URLSearchParams(window.location.search).has("informations")
        ? "legal"
        : null,
  );
  const [request, setRequest] = useState(() => {
    const kind = new URLSearchParams(window.location.search).get("demande");
    return ["contact", "enterprise"].includes(kind) ? { kind } : null;
  });
  const [departmentRequest, setDepartmentRequest] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getSiteData(language)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);
  useEffect(() => {
    if (!data) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    for (const element of document.querySelectorAll(".section-anchor"))
      observer.observe(element);
    return () => observer.disconnect();
  }, [data]);
  function chooseCourse(value) {
    setCourse(null);
    setRequest({
      kind: "registration",
      courseId: value.id,
      timestamp: Date.now(),
    });
    setTimeout(
      () =>
        document
          .getElementById("contact")
          .scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }
  function enterpriseRequest() {
    setRequest({ kind: "enterprise", timestamp: Date.now() });
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  }
  function exploreDepartment(id) {
    setDepartmentRequest({ id, timestamp: Date.now() });
    document
      .getElementById("formations")
      .scrollIntoView({ behavior: "smooth" });
  }
  if (error)
    return (
      <main className="loading-screen">
        <h1>AL-HAKIM CENTER</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Réessayer <RefreshCw size={17} />
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="loading-screen" aria-busy="true">
        <span className="loading-mark">
          AH
          <span />
        </span>
        <p>Bienvenue chez AL-HAKIM CENTER…</p>
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <Header
        centre={data.centre}
        navigation={data.content.navigation}
        active={active}
      />
      <main id="contenu">
        <PublicNav />
        <Home content={data.content} centre={data.centre} />
        <Formations
          courses={data.courses}
          departments={data.departments}
          content={data.content}
          onViewCourse={setCourse}
          departmentRequest={departmentRequest}
        />
        <Centre
          content={data.content}
          departments={data.departments}
          onDepartment={exploreDepartment}
        />
        <Entreprises content={data.content} onRequest={enterpriseRequest} />
        <Partners items={data.portal?.partners || []} />
        {data.portal?.informations?.[0] && (
          <div className="home-information">
            <div className="container">
              <p>
                <strong>{data.portal.informations[0].title}</strong>
                {data.portal.informations[0].description}
              </p>
              <a href="/informations">Toutes les informations →</a>
            </div>
          </div>
        )}
        <Faq items={data.content.faq} />
        <Contact
          centre={data.centre}
          courses={data.courses}
          registrationsAvailable={data.registrationsAvailable}
          request={request}
          onPrivacy={() => setInformation("privacy")}
        />
      </main>
      <Footer
        centre={data.centre}
        departments={data.departments}
        onPrivacy={() => setInformation("privacy")}
        onLegal={() => setInformation("legal")}
        onDepartment={exploreDepartment}
      />
      <a
        className="whatsapp-float"
        href={`https://wa.me/${data.centre.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Contacter AL-HAKIM CENTER sur WhatsApp"
      >
        <MessageCircle size={25} />
        <span>Parlons de votre projet</span>
      </a>
      {course && (
        <CourseDialog
          course={course}
          department={data.departments.find(
            (department) => department.id === course.department,
          )}
          onClose={() => setCourse(null)}
          onSelect={chooseCourse}
        />
      )}
      {information && (
        <Dialog
          title={
            information === "privacy"
              ? "Vos informations, avec respect."
              : "Informations du centre"
          }
          onClose={() => setInformation(null)}
        >
          {information === "privacy" ? (
            <div className="legal-copy">
              <p>
                Les informations du formulaire servent uniquement à comprendre
                votre demande et à permettre au centre de vous recontacter.
              </p>
              <h3>Comment votre demande est-elle transmise ?</h3>
              <p>
                Si l’enregistrement en ligne est disponible, la demande est
                enregistrée dans la base du centre après votre consentement.
                Sinon, le site prépare un message WhatsApp : vous choisissez
                ensuite de l’envoyer dans WhatsApp. Aucun message n’est envoyé
                automatiquement.
              </p>
              <h3>Votre choix reste entre vos mains.</h3>
              <p>
                Vous pouvez demander l’accès, la correction ou la suppression de
                vos informations en contactant AL-HAKIM CENTER au{" "}
                {data.centre.phone}. Ce site n’utilise pas de traceurs
                publicitaires. L’utilisation de WhatsApp est soumise aux
                conditions de ce service.
              </p>
            </div>
          ) : (
            <div className="legal-copy">
              <p>
                <strong>{data.centre.name}</strong>
                <br />
                Formation · Langues · Technologie
              </p>
              <p>
                {data.centre.address}
                <br />
                {data.centre.landmark}
                <br />
                Téléphone : {data.centre.phone}
              </p>
              <p>
                La présentation décrit un projet de centre de formation. Les
                programmes, tarifs, dates d’ouverture et conditions
                d’inscription restent à confirmer directement avec le centre.
              </p>
              <p>
                Les visuels sont illustratifs. Les informations administratives
                complémentaires seront publiées lorsqu’elles seront confirmées.
              </p>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
