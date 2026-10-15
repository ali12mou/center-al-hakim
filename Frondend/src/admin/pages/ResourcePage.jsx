import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Mail,
  MessageCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Inbox,
} from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import { sections, dateLabel, statusLabels } from "../config/sections.js";
import ResourceEditor from "../components/ResourceEditor.jsx";
import RecordDetails from "../components/RecordDetails.jsx";
import MessageComposer from "../components/MessageComposer.jsx";

export default function ResourcePage({ resource }) {
  const config = sections[resource];
  const [data, setData] = useState({ items: [], total: 0, pages: 0 });
  const [courses, setCourses] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState(null);
  const [view, setView] = useState(null);
  const [composer, setComposer] = useState(null);
  useEffect(() => {
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => {
      adminApi(
        `/resources/${resource}?q=${encodeURIComponent(query)}&page=${page}&courseId=${encodeURIComponent(filter)}`,
      )
        .then((value) => {
          if (live) {
            setData(value);
            setError("");
          }
        })
        .catch((failure) => {
          if (live) setError(failure.message);
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [resource, query, page, filter, version]);
  useEffect(() => {
    if (config.person)
      adminApi("/resources/courses?limit=100")
        .then((value) => setCourses(value.items))
        .catch((failure) => setError(failure.message));
  }, [resource]);
  async function remove(item) {
    if (
      !window.confirm(
        `Supprimer « ${item.title} » ? Cette publication sera retirée du site.`,
      )
    )
      return;
    try {
      await adminApi(`/resources/${resource}/${item._id}`, {
        method: "DELETE",
      });
      setVersion((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
    }
  }
  const isRegistration = resource === "registrations";
  const isContact = resource === "contacts";
  const columns = config.person
    ? [
        "ID",
        "Nom complet",
        "Téléphone",
        "E-mail",
        "Compétence / formation",
        "Date",
        ...(isRegistration
          ? ["Username", "Mot de passe", "Profil"]
          : ["Disponibilité", "Message"]),
        "Statut",
        "Actions",
      ]
    : [
        "Publication",
        "Statut",
        "Date",
        ...(resource === "courses" ? ["Département"] : []),
        "Actions",
      ];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">GESTION DU CENTRE</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div className="admin-heading-actions">
          {config.publicPath && (
            <Link className="button button-outline" to={config.publicPath}>
              Voir le site <ArrowUpRight size={16} />
            </Link>
          )}
          <button
            className="button"
            onClick={() => setEditor({ record: null })}
          >
            <Plus size={17} />
            {config.person ? "Ajouter une personne" : "Créer une publication"}
          </button>
        </div>
      </div>
      <div className="admin-resource-bar">
        <div>
          <strong>{data.total}</strong>
          <span>
            {config.person
              ? "personnes enregistrées"
              : "éléments dans cette section"}
          </span>
        </div>
        <label className="admin-search">
          <Search size={17} />
          <input
            value={query}
            placeholder="Rechercher…"
            aria-label="Rechercher dans la section"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {config.person && (
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par formation"
          >
            <option value="">Toutes les formations</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <div className="admin-table-panel">
        <div className="admin-table-scroll">
          <table
            className={
              config.person ? "admin-table admin-person-table" : "admin-table"
            }
          >
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item._id}>
                  {config.person ? (
                    <>
                      <td>
                        <span className="record-id" title={item._id}>
                          {item.reference || item._id.slice(-8)}
                        </span>
                      </td>
                      <td>
                        <span className="person-name">
                          <i>
                            {item.name
                              .split(" ")
                              .map((word) => word[0])
                              .slice(0, 2)
                              .join("")}
                          </i>
                          <strong>{item.name}</strong>
                        </span>
                      </td>
                      <td>{item.phone}</td>
                      <td>{item.email}</td>
                      <td>{item.courseTitle || item.courseId || "—"}</td>
                      <td>{dateLabel(item.createdAt)}</td>
                      {isRegistration ? (
                        <>
                          <td>{item.username || "—"}</td>
                          <td>
                            <span className="password-badge">
                              {item.hasPassword ? "••••••••" : "Non défini"}
                            </span>
                          </td>
                          <td>{item.profile}</td>
                        </>
                      ) : (
                        <>
                          <td>
                            {item.schedule === "flexible"
                              ? "À définir"
                              : item.schedule}
                          </td>
                          <td>
                            <span
                              className="message-excerpt"
                              title={item.message}
                            >
                              {item.message || "—"}
                            </span>
                          </td>
                        </>
                      )}
                      <td>
                        <span className={`admin-status status-${item.status}`}>
                          {statusLabels[item.status]}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className="publication-row">
                          <span>{item.title}</span>
                          <small>{item.description}</small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`admin-status ${item.published ? "status-confirmed" : "status-new"}`}
                        >
                          {item.published ? "Publié" : "Brouillon"}
                        </span>
                      </td>
                      <td>{dateLabel(item.createdAt)}</td>
                      {resource === "courses" && <td>{item.department}</td>}
                    </>
                  )}
                  <td>
                    <div className="admin-actions">
                      <button
                        aria-label={`Voir ${item.name || item.title}`}
                        title="Voir"
                        onClick={() => setView(item)}
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        aria-label={`Modifier ${item.name || item.title}`}
                        title="Modifier"
                        onClick={() => setEditor({ record: item })}
                      >
                        <Pencil size={16} />
                      </button>
                      {config.person ? (
                        <>
                          <button
                            className="action-whatsapp"
                            aria-label={`WhatsApp ${item.name}`}
                            title="WhatsApp"
                            onClick={() =>
                              setComposer({ channel: "whatsapp", record: item })
                            }
                          >
                            <MessageCircle size={17} />
                          </button>
                          <button
                            aria-label={`E-mail ${item.name}`}
                            title="E-mail"
                            onClick={() =>
                              setComposer({ channel: "email", record: item })
                            }
                          >
                            <Mail size={17} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="action-delete"
                          aria-label={`Supprimer ${item.title}`}
                          title="Supprimer"
                          onClick={() => remove(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length && (
          <div className="admin-empty">
            <Inbox size={33} />
            <h3>
              {busy
                ? "Chargement des données…"
                : "Aucun élément pour le moment."}
            </h3>
            <p>
              {busy
                ? "Le centre prépare cette section."
                : "Les nouvelles demandes et publications apparaîtront ici."}
            </p>
          </div>
        )}
        <div className="admin-table-footer">
          <span>
            {data.total} résultat{data.total > 1 ? "s" : ""} · Page {page} sur{" "}
            {Math.max(1, data.pages)}
          </span>
          <div>
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((value) => value + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
      {editor && (
        <ResourceEditor
          resource={resource}
          config={config}
          record={editor.record}
          courses={courses}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {view && (
        <RecordDetails
          record={view}
          config={config}
          onClose={() => setView(null)}
        />
      )}
      {composer && (
        <MessageComposer
          {...composer}
          resource={resource}
          onClose={() => setComposer(null)}
        />
      )}
    </>
  );
}
