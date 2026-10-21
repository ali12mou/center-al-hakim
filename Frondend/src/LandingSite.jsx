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
import LogoLoader from "./components/LogoLoader.jsx";
import Partners from "./components/Partners.jsx";
import LatestInformations from "./components/LatestInformations.jsx";
import { PrivacyContent, LegalContent } from "./components/LegalNotices.jsx";
import { useLanguage } from './context/LanguageContext.jsx';

export default function LandingSite() {
  const { language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
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
        <LogoLoader label="Bienvenue chez AL-HAKIM CENTER…" />
      </main>
    );
  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <Header centre={data.centre} navigation={data.content.navigation} />
      <main id="contenu">
        <PublicNav />
        <Home content={data.content} slides={data.portal?.slides} />
        <LatestInformations items={data.portal?.informations} />
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
        <Faq items={data.content.faq} />
        <Contact
          centre={data.centre}
          courses={data.courses}
          departments={data.departments}
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
            <PrivacyContent centre={data.centre} />
          ) : (
            <LegalContent centre={data.centre} />
          )}
        </Dialog>
      )}
    </>
  );
}
