import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Clock3,
  Layers,
  MapPin,
  MessageCircle,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import Dialog from "./Dialog.jsx";
import { courseImage } from "./courseMedia.js";

// Fiche d’une formation : média en tête, programme à gauche, repères et
// actions à droite (en dessous sur mobile).
function CourseMedia({ course }) {
  return (
    <div className="course-sheet-media">
      {course.videoUrl ? (
        <video
          src={course.videoUrl}
          poster={courseImage(course)}
          controls
          playsInline
          preload="metadata"
          aria-label={`Vidéo de présentation : ${course.title}`}
        />
      ) : (
        <img src={courseImage(course)} alt="" />
      )}
    </div>
  );
}

export default function CourseDialog({
  course,
  department,
  onClose,
  onSelect,
}) {
  const facts = [
    [Users, "Niveau", course.level],
    [Clock3, "Durée", course.duration],
    [MapPin, "Format", `${course.format} · Djibouti`],
    [Layers, "Pôle", department.name],
  ].filter(([, , value]) => value);
  const details = [
    [UserCheck, "Public concerné", course.audience],
    [Target, "Prérequis", course.prerequisites],
  ].filter(([, , value]) => value);
  return (
    <Dialog
      title={course.title}
      onClose={onClose}
      className="course-dialog"
      media={<CourseMedia course={course} />}
    >
      <div className="course-sheet-tags">
        <span className={`pill pill-${department.color}`}>
          {course.tag || department.name}
        </span>
        {course.phase && <span className="pill pill-orange">{course.phase}</span>}
      </div>
      <div className="course-sheet">
        <div className="course-sheet-main">
          <p className="dialog-description">{course.description}</p>
          {course.topics?.length > 0 && (
            <>
              <h3>Ce que vous allez explorer</h3>
              <ul className="course-sheet-topics">
                {course.topics.map((topic) => (
                  <li key={topic}>
                    <span>
                      <Check size={14} />
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
            </>
          )}
          {details.length > 0 && (
            <div className="course-sheet-details">
              {details.map(([Icon, label, value]) => (
                <div key={label}>
                  <h4>
                    <Icon size={16} /> {label}
                  </h4>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="course-sheet-side">
          <dl className="course-sheet-facts">
            {facts.map(([Icon, label, value]) => (
              <div key={label}>
                <dt>
                  <Icon size={16} /> {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <button
            className="button"
            type="button"
            onClick={() => onSelect(course)}
          >
            Cette formation m’intéresse <ArrowRight size={17} />
          </button>
          <Link className="button button-outline" to="/contact">
            <MessageCircle size={16} /> Poser une question
          </Link>
          <p className="course-sheet-note">
            {course.phase &&
              `${course.phase} : disponibilité à confirmer auprès du centre. `}
            Le niveau, la durée, les dates et le tarif sont précisés avec le
            centre avant toute inscription.
          </p>
        </aside>
      </div>
    </Dialog>
  );
}
