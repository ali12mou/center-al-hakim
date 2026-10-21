import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingSite from "./LandingSite.jsx";
import FormationsPage from "./pages/FormationsPage.jsx";
import CentrePage from "./pages/CentrePage.jsx";
import EntreprisesPage from "./pages/EntreprisesPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import SkillsPage from "./pages/SkillsPage.jsx";
import InformationPage from "./pages/InformationPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import BusinessesPage from "./pages/BusinessesPage.jsx";
import CertificationsPage from "./pages/CertificationsPage.jsx";
import SkillAssessmentPage from "./pages/SkillAssessmentPage.jsx";
import InscriptionPage from "./pages/InscriptionPage.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import IntroSplash from "./components/IntroSplash.jsx";
import { LanguageProvider } from './context/LanguageContext.jsx';

// En changeant de page, on repart du haut (sauf lien vers un bloc précis).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider><IntroSplash /><ScrollToTop /><Routes>
        <Route path="/" element={<LandingSite />} />
        <Route path="/formations" element={<FormationsPage />} />
        <Route path="/centre" element={<CentrePage />} />
        <Route path="/entreprises" element={<EntreprisesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route
          path="/courses"
          element={<FormationsPage eyebrow="COURSES · NOS FORMATIONS" />}
        />
        <Route path="/competences" element={<SkillsPage />} />
        <Route path="/informations" element={<InformationPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:id" element={<BlogPage />} />
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/certifications" element={<CertificationsPage />} />
        <Route path="/skill-assessment" element={<SkillAssessmentPage />} />
        <Route path="/inscription" element={<InscriptionPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route
          path="*"
          element={
            <div className="loading-screen">
              <h1>Page introuvable</h1>
              <a className="button" href="/">
                Retour à l’accueil
              </a>
            </div>
          }
        />
      </Routes></LanguageProvider>
    </BrowserRouter>
  );
}
