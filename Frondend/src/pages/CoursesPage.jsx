import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import Formations from "./Formations.jsx";
import CourseDialog from "../components/CourseDialog.jsx";

export default function CoursesPage() {
  const { data, error } = usePublicSite();
  const [course, setCourse] = useState(null);
  const navigate = useNavigate();
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="COURSES · NOS FORMATIONS"
      title="Le parcours qui vous ressemble."
      description="Explorez les programmes publiés par le centre et préparez votre prochaine étape."
    >
      {data && (
        <Formations {...data} onViewCourse={setCourse} content={data.content} />
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
