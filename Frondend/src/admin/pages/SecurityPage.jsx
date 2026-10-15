import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  History,
  KeyRound,
  LogIn,
  MonitorSmartphone,
  ShieldAlert,
} from "lucide-react";
import PasswordForm from "../components/PasswordForm.jsx";
import SecurityEvents from "../components/SecurityEvents.jsx";
import { adminApi } from "../services/adminApi.js";
import { dateLabel, dateTimeLabel } from "../config/sections.js";

export default function SecurityPage({ user, onSessionRenewed }) {
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      Promise.all([adminApi("/security"), adminApi("/auth/sessions")])
        .then(([security, list]) => {
          setOverview(security);
          setSessions(list.sessions);
        })
        .catch((failure) => setError(failure.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function revokeOthers() {
    if (!window.confirm("Fermer toutes les autres sessions de ce compte ?")) return;
    setBusy(true);
    setError("");
    try {
      const { revoked } = await adminApi("/auth/sessions", { method: "DELETE" });
      setMessage(
        revoked
          ? `${revoked} autre${revoked > 1 ? "s" : ""} session${revoked > 1 ? "s" : ""} fermée${revoked > 1 ? "s" : ""}.`
          : "Aucune autre session n’était ouverte.",
      );
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const facts = overview
    ? [
        [
          LogIn,
          "Connexion précédente",
          overview.previousLogin ? dateTimeLabel(overview.previousLogin.at) : "—",
          overview.previousLogin?.device || "Première connexion",
        ],
        [
          MonitorSmartphone,
          "Sessions actives",
          overview.activeSessions,
          "Sur ce compte",
        ],
        [
          ShieldAlert,
          "Échecs (24 h)",
          overview.failures24h,
          "Tous identifiants confondus",
        ],
        [
          KeyRound,
          "Mot de passe",
          dateLabel(overview.passwordChangedAt),
          "Dernière modification",
        ],
      ]
    : [];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">COMPTE</span>
          <h1>Sécurité du compte</h1>
          <p>Mot de passe, appareils connectés et journal des connexions.</p>
        </div>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      <div className="admin-stats security-facts">
        {facts.map(([Icon, label, value, note]) => (
          <div className="admin-stat" key={label}>
            <span className="stat-top">
              <span>{label}</span>
              <span className="stat-icon">
                <Icon size={18} />
              </span>
            </span>
            <strong>{value}</strong>
            <span className="stat-note">{note}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Changer le mot de passe</h2>
            <KeyRound size={18} />
          </div>
          <div className="panel-body">
            <PasswordForm
              user={user}
              onChanged={(value) => {
                onSessionRenewed(value);
                load();
              }}
            />
          </div>
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Appareils connectés</h2>
            <button
              className="panel-action"
              onClick={revokeOthers}
              disabled={busy || !sessions || sessions.length < 2}
            >
              Déconnecter les autres
            </button>
          </div>
          {sessions ? (
            <ul className="session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <span className="security-event-icon">
                    <MonitorSmartphone size={16} />
                  </span>
                  <span>
                    <strong>
                      {session.device}
                      {session.current && <em>Cet appareil</em>}
                    </strong>
                    <small>
                      {session.ip || "Adresse inconnue"} · connecté le{" "}
                      {dateTimeLabel(session.createdAt)}
                    </small>
                  </span>
                  <time dateTime={session.lastSeenAt}>
                    Actif {dateTimeLabel(session.lastSeenAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-zero">Chargement des sessions…</p>
          )}
          {overview && (
            <p className="panel-note">
              <Clock size={15} />
              Déconnexion automatique après {overview.idleMinutes} min
              d’inactivité, et au plus tard {overview.maxHours} h après la
              connexion.
            </p>
          )}
        </section>
      </div>
      <section className="dashboard-panel">
        <div className="panel-heading">
          <h2>Journal de sécurité</h2>
          <History size={18} />
        </div>
        <SecurityEvents items={overview?.events} />
      </section>
    </>
  );
}
