import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Mail,
  BookOpen,
  ClipboardCheck,
  ArrowUpRight,
  Plus,
  TrendingUp,
} from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import { dateLabel } from "../config/sections.js";

export default function DashboardPage({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    adminApi("/dashboard")
      .then(setData)
      .catch((failure) => setError(failure.message));
  }, []);
  const stats = data
    ? [
        [
          Users,
          "Inscrits",
          data.counts.registrations,
          "Demandes de formation",
          "/admin/registrations",
        ],
        [
          Mail,
          "Contacts",
          data.counts.contacts,
          `${data.counts.unread} à traiter`,
          "/admin/contacts",
        ],
        [
          BookOpen,
          "Formations",
          data.counts.courses,
          `${data.counts.published} publiées sur le site`,
          "/admin/courses",
        ],
        [
          ClipboardCheck,
          "Évaluations",
          data.counts.attempts,
          "Tests réalisés",
          "/admin/assessments",
        ],
      ]
    : [];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">VOTRE CENTRE, EN UN COUP D’ŒIL</span>
          <h1>Bonjour {user.name.split(" ")[0]}.</h1>
          <p>Voici l’activité de AL-HAKIM CENTER.</p>
        </div>
        <Link to="/admin/courses" className="button">
          <Plus size={17} />
          Gérer les formations
        </Link>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-stats">
        {stats.map(([Icon, label, value, note, path]) => (
          <Link to={path} className="admin-stat" key={label}>
            <span className="stat-top">
              <span>{label}</span>
              <Icon size={24} />
            </span>
            <strong>{value}</strong>
            <span className="stat-note">
              {note}
              <ArrowUpRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Inscriptions par formation</h2>
            <TrendingUp size={20} />
          </div>
          {data?.perCourse.length ? (
            <div className="course-bars">
              {data.perCourse.map((item) => (
                <div key={item._id}>
                  <span>
                    {item.title}
                    <b>{item.count}</b>
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${(item.count / Math.max(...data.perCourse.map((value) => value.count))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-zero">
              Le nombre de personnes inscrites à chaque formation apparaîtra
              ici.
            </p>
          )}
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Vos raccourcis</h2>
          </div>
          <div className="dashboard-shortcuts">
            <Link to="/admin/blog">
              <BookOpen size={21} />
              <span>
                Publier un article
                <small>Partagez les actualités du centre</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <Link to="/admin/informations">
              <Mail size={21} />
              <span>
                Communiquer une information
                <small>Informez les visiteurs du site</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <Link to="/admin/contacts">
              <Users size={21} />
              <span>
                Traiter les demandes
                <small>Répondez aux personnes intéressées</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </div>
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
                  <th>Référence</th>
                  <th>Nom complet</th>
                  <th>E-mail</th>
                  <th>Téléphone</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((item) => (
                  <tr key={item._id}>
                    <td>{item.reference}</td>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.phone}</td>
                    <td>{dateLabel(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="dashboard-zero">
            Aucune inscription enregistrée pour le moment.
          </p>
        )}
      </section>
      <section className="dashboard-panel monthly-panel">
        <div className="panel-heading">
          <h2>Évolution mensuelle des inscriptions</h2>
        </div>
        {data?.monthly.length ? (
          <div className="monthly-bars">
            {data.monthly.map((item) => (
              <div key={item._id}>
                <strong>{item.count}</strong>
                <i
                  style={{
                    height: `${Math.max(8, (item.count / Math.max(...data.monthly.map((value) => value.count))) * 100)}px`,
                  }}
                />
                <span>{item._id}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-zero">
            L’évolution sera calculée à partir des inscriptions enregistrées.
          </p>
        )}
      </section>
    </>
  );
}
