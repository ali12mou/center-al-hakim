import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Search,
  X,
  Users,
  Languages,
  BriefcaseBusiness,
  Monitor,
  ChartNoAxesCombined,
} from "lucide-react";

const icons = {
  langues: Languages,
  management: BriefcaseBusiness,
  informatique: Monitor,
  finance: ChartNoAxesCombined,
};
export default function Formations({
  courses,
  departments,
  content,
  onViewCourse,
  departmentRequest,
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(4);
  useEffect(() => {
    if (departmentRequest) {
      setCategory(departmentRequest.id);
      setQuery("");
      setLimit(4);
    }
  }, [departmentRequest]);
  const filtered = useMemo(() => {
    const normalized = (value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("fr");
    return courses.filter(
      (course) =>
        (category === "all" || course.department === category) &&
        normalized(`${course.title} ${course.description}`).includes(
          normalized(query.trim()),
        ),
    );
  }, [category, query, courses]);
  function chooseCategory(value) {
    setCategory(value);
    setLimit(4);
  }
  return (
    <section id="formations" className="section catalogue section-anchor">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TROUVEZ VOTRE PROCHAINE ÉTAPE</span>
            <h2>
              Une compétence.
              <br className="mobile-break" /> De nouvelles possibilités.
            </h2>
            <p>Choisissez le parcours qui donne du sens à vos ambitions.</p>
          </div>
          <span className="section-number" aria-hidden="true">
            01 <span>/ NOS FORMATIONS</span>
          </span>
        </div>
        <div className="catalogue-toolbar">
          <div
            className="filters"
            role="group"
            aria-label="Filtrer les formations par département"
          >
            <button
              className={category === "all" ? "filter active" : "filter"}
              onClick={() => chooseCategory("all")}
            >
              Toutes les formations
            </button>
            {departments.map((department) => (
              <button
                className={
                  category === department.id ? "filter active" : "filter"
                }
                key={department.id}
                onClick={() => chooseCategory(department.id)}
              >
                {department.id === "management"
                  ? "Management"
                  : department.id === "informatique"
                    ? "Informatique"
                    : department.id === "finance"
                      ? "Comptabilité & finance"
                      : department.name}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Rechercher une formation"
              aria-label="Rechercher une formation"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(4);
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                type="button"
                aria-label="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </label>
        </div>
        <p className="sr-only" aria-live="polite">
          {filtered.length} formations trouvées.
        </p>
        <div className="course-grid">
          {filtered.slice(0, limit).map((course) => {
            const department = departments.find(
              (item) => item.id === course.department,
            );
            const Icon = icons[course.department];
            return (
              <article className="course-card" key={course.id}>
                <button
                  className="course-image-button"
                  type="button"
                  onClick={() => onViewCourse(course)}
                  aria-label={`Découvrir ${course.title}`}
                >
                  <img
                    src={`/images/${course.image}.jpg`}
                    alt=""
                    loading="lazy"
                    width="640"
                    height="420"
                  />
                  <span className={`pill pill-${department.color}`}>
                    {course.tag || department.name}
                  </span>
                  <span className="course-image-icon">
                    <Icon size={19} />
                  </span>
                </button>
                <div className="course-card-body">
                  <span className="course-level">
                    <Users size={13} /> {course.level}
                  </span>
                  <h3>
                    <button onClick={() => onViewCourse(course)}>
                      {course.title}
                    </button>
                  </h3>
                  <p>{course.description}</p>
                  <div className="course-card-bottom">
                    <span>
                      {course.phase ? "À venir" : "Programme proposé"}
                    </span>
                    <button
                      className="course-link"
                      onClick={() => onViewCourse(course)}
                      aria-label={`Voir le programme ${course.title}`}
                    >
                      Le programme <ArrowUpRight size={17} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="empty-results">
            <Search size={28} />
            <h3>Aucune formation ne correspond à votre recherche.</h3>
            <p>Essayez un autre mot-clé ou explorez tous les programmes.</p>
            <button
              className="button button-outline"
              onClick={() => {
                setQuery("");
                chooseCategory("all");
              }}
            >
              Voir toutes les formations
            </button>
          </div>
        )}
        <div className="catalogue-bottom">
          <p>{content.catalogueNote}</p>
          {filtered.length > limit && (
            <button
              className="button button-outline"
              onClick={() => setLimit((value) => value + 8)}
            >
              Voir plus de formations <ArrowDown size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
