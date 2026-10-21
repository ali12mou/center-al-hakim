import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  ListChecks,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import PublicPageLayout, {
  usePublicSite,
} from "../components/PublicPageLayout.jsx";
import RequestForm from "../components/RequestForm.jsx";
import Faq from "../components/Faq.jsx";
import Dialog from "../components/Dialog.jsx";
import { PrivacyContent } from "../components/LegalNotices.jsx";
import { courseImage } from "../components/courseMedia.js";
import { whatsappLink } from "../components/whatsapp.js";

const steps = [
  ["Choisissez votre formation", "Dans la liste ou depuis le catalogue."],
  ["Laissez vos coordonnées", "Nom, téléphone, e-mail et vos objectifs."],
  ["Le centre vous recontacte", "Pour préciser niveau, dates et tarifs."],
];

// Formation choisie, rappelée à côté du formulaire.
function ChosenCourse({ course, department }) {
  if (!course)
    return (
      <div className="registration-course is-empty">
        <span className="registration-course-icon">
          <BookOpen size={24} />
        </span>
        <strong>Aucune formation choisie</strong>
        <p>Sélectionnez-la dans le formulaire ou parcourez le catalogue.</p>
        <Link className="text-link" to="/formations">
          Voir les formations <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="registration-course">
      <img src={courseImage(course)} alt="" />
      <div className="registration-course-body">
        <span className={`pill pill-${department?.color || "blue"}`}>
          {department?.name || "Formation"}
        </span>
        <strong>{course.title}</strong>
        <ul>
          <li>
            <Users size={15} /> {course.level}
          </li>
          <li>
            <Clock3 size={15} /> {course.duration}
          </li>
          <li>
            <MapPin size={15} /> {course.format} · Djibouti
          </li>
          {course.topics?.length > 0 && (
            <li>
              <ListChecks size={15} /> {course.topics.length} thèmes au
              programme
            </li>
          )}
        </ul>
        <Link className="text-link" to="/formations">
          Changer de formation <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}

export default function InscriptionPage() {
  const { data, error } = usePublicSite();
  const [search] = useSearchParams();
  const [privacy, setPrivacy] = useState(false);
  const [courseId, setCourseId] = useState(search.get("formation") || "");
  const request = useMemo(
    () => ({ kind: "registration", courseId: search.get("formation") || "" }),
    [search],
  );
  const course = data?.courses.find((item) => item.id === courseId);
  const department = data?.departments.find(
    (item) => item.id === course?.department,
  );
  return (
    <PublicPageLayout
      data={data}
      error={error}
      eyebrow="PRÉINSCRIPTION"
      title="Faites le premier pas."
      description="Votre demande permet au centre de préciser avec vous les dates, tarifs et modalités."
    >
      {data && (
        <>
          <section className="section registration">
            <div className="container">
              <ol className="registration-steps">
                {steps.map(([title, text], index) => (
                  <li key={title}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="registration-grid">
                <RequestForm
                  variant="registration"
                  centre={data.centre}
                  courses={data.courses}
                  departments={data.departments}
                  registrationsAvailable={data.registrationsAvailable}
                  request={request}
                  onCourseChange={setCourseId}
                  onPrivacy={() => setPrivacy(true)}
                />
                <aside className="registration-side">
                  <ChosenCourse course={course} department={department} />
                  <div className="registration-card">
                    <h3>Une préinscription, c’est :</h3>
                    <ul className="registration-promises">
                      {[
                        "Sans engagement : elle ne réserve pas encore de place.",
                        "Un échange avec le centre pour définir votre niveau et vos horaires.",
                        "Des dates, tarifs et conditions confirmés avant toute inscription.",
                        "Des informations utilisées uniquement pour traiter votre demande.",
                      ].map((item) => (
                        <li key={item}>
                          <Check size={15} /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="registration-card">
                    <h3>Besoin d’aide ?</h3>
                    <a href={`tel:${data.centre.phoneLink}`}>
                      <Phone size={16} /> {data.centre.phone}
                    </a>
                    <a
                      href={whatsappLink(data.centre)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={16} /> Discuter sur WhatsApp
                    </a>
                    <a href={`mailto:${data.centre.email}`}>
                      <Mail size={16} /> {data.centre.email}
                    </a>
                  </div>
                </aside>
              </div>
            </div>
          </section>
          <Faq items={data.content.faq} />
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
