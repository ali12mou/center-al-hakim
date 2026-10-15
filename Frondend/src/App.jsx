import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingSite from "./LandingSite.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
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

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider><IntroSplash /><Routes>
        <Route path="/" element={<LandingSite />} />
        <Route path="/courses" element={<CoursesPage />} />
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
