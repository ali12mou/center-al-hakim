import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import Entreprises from "./Entreprises.jsx";
import Contact from "./Contact.jsx";
import { Departments, Journey } from "./Centre.jsx";
import Dialog from "../components/Dialog.jsx";
import { PrivacyContent } from "../components/LegalNotices.jsx";

export default function EntreprisesPage() {
  const { data, error } = usePublicSite();
  const navigate = useNavigate();
  const [privacy, setPrivacy] = useState(false);
  const [request, setRequest] = useState({ kind: "enterprise" });
  const offers = data?.portal?.businesses || [];
  const scrollToForm = () => {
    setRequest({ kind: "enterprise", timestamp: Date.now() });
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };
  const steps = useMemo(() => data?.content.enterprise.steps || [], [data]);
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="ENTREPRISES & INSTITUTIONS"
      title="Des formations pensées pour vos équipes."
      description="Langues, management, outils numériques, finance : un programme construit avec vous, selon votre activité et vos objectifs."
    >
      {data && (
        <>
          <Entreprises content={data.content} onRequest={scrollToForm} />
          <Journey
            steps={steps}
            eyebrow="COMMENT NOUS TRAVAILLONS"
            title="Un programme construit avec vous."
          />
          {offers.length > 0 && (
            <section className="section">
              <div className="container">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">NOS OFFRES</span>
                    <h2>Des formats pour chaque organisation.</h2>
                  </div>
                </div>
                <div className="publication-grid">
                  {offers.map((item) => (
                    <article className="publication-card" key={item._id}>
                      <span className="publication-icon">
                        <Building2 size={33} />
                      </span>
                      <span className="publication-category">
                        {item.audience}
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      {item.benefits?.length > 0 && (
                        <ul className="check-list">
                          {item.benefits.map((benefit) => (
                            <li key={benefit}>
                              <Check size={15} />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
          <Departments
            departments={data.departments}
            onDepartment={(id) => navigate(`/formations?pole=${id}`)}
          />
          <Contact
            centre={data.centre}
            courses={data.courses}
            departments={data.departments}
            registrationsAvailable={data.registrationsAvailable}
            request={request}
            onPrivacy={() => setPrivacy(true)}
          />
        </>
      )}
      {privacy && (
        <Dialog
          title="Vos informations, avec respect."
          onClose={() => setPrivacy(false)}
        >
          <PrivacyContent centre={data.centre} />
        </Dialog>
      )}
    </PublicPageLayout>
  );
}
