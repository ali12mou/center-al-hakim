import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, ClipboardList, Layers, MapPin } from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import Formations from "./Formations.jsx";
import { Journey } from "./Centre.jsx";
import CourseDialog from "../components/CourseDialog.jsx";
import Faq from "../components/Faq.jsx";
import { PageCta } from "../components/PageBlocks.jsx";

// Sert aussi /courses (menu secondaire) : une seule page catalogue.
export default function FormationsPage({ eyebrow = "NOS FORMATIONS" }) {
  const { data, error } = usePublicSite();
  const [course, setCourse] = useState(null);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  // /formations?pole=langues ouvre le catalogue déjà filtré (liens du pied de page).
  const pole = data?.departments.some((item) => item.id === search.get("pole"))
    ? search.get("pole")
    : null;
  const departmentRequest = useMemo(() => pole && { id: pole }, [pole]);
  useEffect(() => {
    if (pole)
      document
        .getElementById("formations")
        ?.scrollIntoView({ behavior: "smooth" });
  }, [pole]);
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow={eyebrow}
      title="Quatre pôles pour faire avancer vos ambitions."
      description="Langues, management, informatique, comptabilité : explorez les programmes proposés par le centre et préparez votre préinscription."
    >
      {data && (
        <>
          <div className="catalogue-stats">
            <div className="container">
              {[
                [BookOpen, data.courses.length, "formations au catalogue"],
                [Layers, data.departments.length, "pôles de formation"],
                [MapPin, "Présentiel", "à Balbala, Djibouti"],
                [ClipboardList, "En ligne", "demande de préinscription"],
              ].map(([Icon, value, label]) => (
                <div key={label}>
                  <span className="catalogue-stat-icon">
                    <Icon size={20} />
                  </span>
                  <span>
                    <strong>{value}</strong>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Formations
            courses={data.courses}
            departments={data.departments}
            content={data.content}
            onViewCourse={setCourse}
            departmentRequest={departmentRequest}
            pageSize={8}
          />
          <Journey
            steps={data.content.steps}
            eyebrow="COMMENT S’INSCRIRE"
            title="Trois étapes vers votre formation."
          />
          <Faq items={data.content.faq} />
          <PageCta
            eyebrow="PRÊT À COMMENCER ?"
            title="Votre prochaine compétence vous attend."
            text="Faites votre demande de préinscription : le centre vous recontacte pour les dates, tarifs et modalités."
            primary={{ to: "/inscription", label: "Faire ma préinscription" }}
            secondary={{ to: "/contact", label: "Poser une question" }}
          />
        </>
      )}
      {course && (
        <CourseDialog
          course={course}
          department={data.departments.find(
            (item) => item.id === course.department,
          )}
          onClose={() => setCourse(null)}
          onSelect={(item) =>
            navigate(`/inscription?formation=${encodeURIComponent(item.id)}`)
          }
        />
      )}
    </PublicPageLayout>
  );
}
