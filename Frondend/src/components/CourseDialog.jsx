import { ArrowRight, Check, Clock3, Users, MapPin } from "lucide-react";
import Dialog from "./Dialog.jsx";

export default function CourseDialog({
  course,
  department,
  onClose,
  onSelect,
}) {
  return (
    <Dialog title={course.title} onClose={onClose} className="course-dialog">
      <span className={`pill pill-${department.color}`}>{department.name}</span>
      <p className="dialog-description">{course.description}</p>
      <div className="course-facts">
        <span>
          <Users size={17} /> {course.level}
        </span>
        <span>
          <Clock3 size={17} /> {course.duration}
        </span>
        <span>
          <MapPin size={17} /> {course.format} · Djibouti
        </span>
      </div>
      <h3>Ce que vous allez explorer</h3>
      <ul className="check-list">
        {course.topics.map((topic) => (
          <li key={topic}>
            <Check size={17} /> {topic}
          </li>
        ))}
      </ul>
      {course.phase && (
        <p className="programme-phase">
          {course.phase} : disponibilité à confirmer auprès du centre.
        </p>
      )}
      <p className="muted small">
        Le niveau, les objectifs, la durée, les dates et le tarif sont précisés
        avec le centre avant toute inscription.
      </p>
      <button className="button" type="button" onClick={() => onSelect(course)}>
        Cette formation m’intéresse <ArrowRight size={17} />
      </button>
    </Dialog>
  );
}
