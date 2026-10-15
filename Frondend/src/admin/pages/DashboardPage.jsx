import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Globe,
  History,
  Inbox,
  Mail,
  Minus,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import MonthlyChart from "../components/MonthlyChart.jsx";
import SecurityEvents from "../components/SecurityEvents.jsx";
import { adminApi } from "../services/adminApi.js";
import {
  dateLabel,
  dateTimeLabel,
  initials,
  statusLabels,
} from "../config/sections.js";

const today = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Nairobi",
});
const plural = (count, word) => `${count} ${word}${count > 1 ? "s" : ""}`;

function Bars({ items }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="course-bars">
      {items.map((item) => (
        <div key={item.key}>
          <span>
            {item.label}
            <b>{item.count}</b>
          </span>
          <div>
            <i style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Trend({ current, previous }) {
  const delta = current - previous;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span className="stat-trend">
      <Icon size={14} />
      {delta > 0 ? `+${delta}` : delta} vs mois dernier
    </span>
  );
}

export default function DashboardPage({ user }) {
  const [data, setData] = useState(null);
  const [security, setSecurity] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    adminApi("/dashboard")
      .then(setData)
      .catch((failure) => setError(failure.message));
    adminApi("/security")
      .then(setSecurity)
      .catch(() => setSecurity({ events: [] }));
  }, []);
  const counts = data?.counts;
  const stats = counts
    ? [
        [Users, "Inscrits", counts.registrations, plural(counts.newRegistrations, "nouvelle demande"), "/admin/registrations", "navy"],
        [Mail, "Contacts", counts.contacts, `${counts.unread} à traiter`, "/admin/contacts", "pink"],
        [BookOpen, "Formations", counts.courses, plural(counts.published, "publiée"), "/admin/courses", "blue"],
        [ClipboardCheck, "Évaluations", counts.attempts, "Tests réalisés", "/admin/assessments", "green"],
      ]
    : [];
  const date = today.format(new Date());
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">
            {date.charAt(0).toUpperCase() + date.slice(1)}
          </span>
          <h1>Bonjour {user.name.split(" ")[0]}.</h1>
          <p>Voici l’activité de AL-HAKIM CENTER.</p>
        </div>
        <div className="admin-heading-actions">
          <Link to="/" className="button button-outline">
            <Globe size={17} />
            Voir le site
          </Link>
          <Link to="/admin/courses" className="button">
            <Plus size={17} />
            Gérer les formations
          </Link>
        </div>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stats">
        {counts
          ? stats.map(([Icon, label, value, note, path, tone]) => (
              <Link to={path} className={`admin-stat tone-${tone}`} key={label}>
                <span className="stat-top">
                  <span>{label}</span>
                  <span className="stat-icon">
                    <Icon size={18} />
                  </span>
                </span>
                <strong>{value}</strong>
                <span className="stat-note">
                  {label === "Inscrits" ? (
                    <Trend current={counts.thisMonth} previous={counts.lastMonth} />
                  ) : (
                    note
                  )}
                  <ArrowUpRight size={15} />
                </span>
              </Link>
            ))
          : [0, 1, 2, 3].map((index) => (
              <div className="admin-stat is-loading" key={index} aria-hidden="true" />
            ))}
      </div>
      <div className="dashboard-grid dashboard-grid-wide">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Inscriptions sur 12 mois</h2>
              {counts && (
                <small>
                  {plural(counts.registrations, "inscription")} au total ·{" "}
                  {counts.thisMonth} ce mois-ci
                </small>
              )}
            </div>
            <TrendingUp size={18} />
          </div>
          {data ? (
            <MonthlyChart months={data.monthly} />
          ) : (
            <div className="panel-skeleton" />
          )}
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Suivi des inscriptions</h2>
              <small>Répartition par statut</small>
            </div>
          </div>
          {data && (
            <Bars
              items={data.perStatus.map((item) => ({
                key: item.status,
                label: statusLabels[item.status],
                count: item.count,
              }))}
            />
          )}
          <Link to="/admin/registrations" className="panel-footer-link">
            Traiter les nouvelles demandes <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="dashboard-grid dashboard-grid-wide">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Dernières inscriptions</h2>
            <Link to="/admin/registrations">
              Tout voir <ArrowUpRight size={15} />
            </Link>
          </div>
          {data?.recent.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Apprenant</th>
                    <th>Formation</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <span className="person-name">
                          <i>{initials(item.name)}</i>
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.email}</small>
                          </span>
                        </span>
                      </td>
                      <td>{item.courseTitle}</td>
                      <td>
                        <span className={`admin-status status-${item.status}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="nowrap">{dateLabel(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-zero">
              {data
                ? "Aucune inscription enregistrée pour le moment."
                : "Chargement…"}
            </p>
          )}
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Contacts à traiter</h2>
              {counts && <small>{counts.unread} en attente de réponse</small>}
            </div>
            <Link to="/admin/contacts">
              Ouvrir <ArrowUpRight size={15} />
            </Link>
          </div>
          {data?.pendingContacts.length ? (
            <ul className="pending-list">
              {data.pendingContacts.map((item) => (
                <li key={item._id}>
                  <span className="admin-avatar">{initials(item.name)}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.message || item.email}</small>
                  </span>
                  <time dateTime={item.createdAt}>
                    {dateTimeLabel(item.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dashboard-zero">
              <Inbox size={22} />
              <p>{data ? "Aucun message en attente." : "Chargement…"}</p>
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Inscriptions par formation</h2>
              <small>Les six formations les plus demandées</small>
            </div>
          </div>
          {data?.perCourse.length ? (
            <Bars
              items={data.perCourse.map((item) => ({
                key: item._id || "none",
                label: item.title,
                count: item.count,
              }))}
            />
          ) : (
            <p className="dashboard-zero">
              Le nombre d’inscrits par formation apparaîtra ici.
            </p>
          )}
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Sécurité</h2>
              {security?.previousLogin && (
                <small>
                  Connexion précédente : {dateTimeLabel(security.previousLogin.at)}
                  {" · "}
                  {security.previousLogin.device}
                </small>
              )}
            </div>
            <Link to="/admin/security">
              Gérer <ArrowUpRight size={15} />
            </Link>
          </div>
          {security && "activeSessions" in security && (
            <div className="security-summary">
              <span>
                <strong>{security.activeSessions}</strong>
                session{security.activeSessions > 1 ? "s" : ""} active
                {security.activeSessions > 1 ? "s" : ""}
              </span>
              <span>
                <strong>{security.failures24h}</strong>
                échec{security.failures24h > 1 ? "s" : ""} de connexion (24 h)
              </span>
            </div>
          )}
          <SecurityEvents items={security?.events} limit={4} />
          <Link to="/admin/security" className="panel-footer-link">
            <History size={15} /> Journal complet
          </Link>
        </section>
      </div>
    </>
  );
}
