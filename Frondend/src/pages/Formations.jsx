import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Search,
  X,
  Users,
  MapPin,
  ListChecks,
  Play,
} from "lucide-react";
import { courseImage, departmentShortName } from "../components/courseMedia.js";

const normalized = (value) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr");

export default function Formations({
  courses,
  departments,
  content,
  onViewCourse,
  departmentRequest,
  pageSize = 4,
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => {
    if (departmentRequest) {
      setCategory(departmentRequest.id);
      setQuery("");
      setLimit(pageSize);
    }
  }, [departmentRequest]);
  const filtered = useMemo(
    () =>
      courses.filter(
        (course) =>
          (category === "all" || course.department === category) &&
          normalized(`${course.title} ${course.description}`).includes(
            normalized(query.trim()),
          ),
      ),
    [category, query, courses],
  );
  const counts = useMemo(() => {
    const result = {};
    for (const course of courses)
      result[course.department] = (result[course.department] || 0) + 1;
    return result;
  }, [courses]);
  const selected = departments.find((item) => item.id === category);
  function chooseCategory(value) {
    setCategory(value);
    setLimit(pageSize);
  }
  const filters = [
    ["all", "Toutes les formations", courses.length],
    ...departments.map((department) => [
      department.id,
      departmentShortName(department),
      counts[department.id] || 0,
    ]),
  ];
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
            {filters.map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                className={category === value ? "filter active" : "filter"}
                aria-pressed={category === value}
                onClick={() => chooseCategory(value)}
              >
                <span className="filter-label">{label}</span>
                <span className="filter-count">{count}</span>
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
                setLimit(pageSize);
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
        <p className="catalogue-summary" aria-live="polite">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length > 1 ? "formations" : "formation"}
          {selected && ` · ${selected.name}`}
          {query.trim() && ` · « ${query.trim()} »`}
        </p>
        <div className="course-grid">
          {filtered.slice(0, limit).map((course) => {
            const department = departments.find(
              (item) => item.id === course.department,
            );
            const view = () => onViewCourse(course);
            return (
              <article className="course-card" key={course.id}>
                <button
                  className="course-media"
                  type="button"
                  onClick={view}
                  aria-label={`Découvrir ${course.title}`}
                >
                  <img
                    src={courseImage(course)}
                    alt=""
                    loading="lazy"
                    width="640"
                    height="420"
                    onError={(event) => {
                      // Image importée introuvable : illustration du pôle.
                      const fallback = `/images/${course.image || course.department}.jpg`;
                      if (!event.currentTarget.src.endsWith(fallback))
                        event.currentTarget.src = fallback;
                    }}
                  />
                  <span className={`pill pill-${department.color}`}>
                    {course.tag || department.name}
                  </span>
                  {course.videoUrl && (
                    <span className="course-badge">
                      <Play size={11} fill="currentColor" /> Vidéo
                    </span>
                  )}
                  {course.phase && (
                    <span className="course-badge course-badge-soon">
                      À venir
                    </span>
                  )}
                </button>
                <div className="course-card-body">
                  <div className="course-meta">
                    <span>
                      <Users size={14} /> {course.level}
                    </span>
                    <span>
                      <MapPin size={14} /> {course.format}
                    </span>
                  </div>
                  <h3>
                    <button type="button" onClick={view}>
                      {course.title}
                    </button>
                  </h3>
                  <p>{course.description}</p>
                  {course.topics?.length > 0 && (
                    <span className="course-topics">
                      <ListChecks size={15} /> {course.topics.length} thèmes
                      au programme
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="course-card-footer"
                  onClick={view}
                  aria-label={`Voir le programme ${course.title}`}
                >
                  Découvrir le programme
                  <span className="course-card-arrow">
                    <ArrowUpRight size={16} />
                  </span>
                </button>
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
              Voir plus de formations ({filtered.length - limit})
              <ArrowDown size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
