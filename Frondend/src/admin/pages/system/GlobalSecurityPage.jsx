import { useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MonitorSmartphone,
  ServerCrash,
  ShieldAlert,
  ShieldX,
  Users,
} from "lucide-react";
import SecurityEvents, { eventLabels } from "../../components/SecurityEvents.jsx";
import { Alert, PageHeading, Panel, SimpleTable, StatGrid, Tabs } from "../../components/ui.jsx";
import { adminApi } from "../../services/adminApi.js";
import { useRemote } from "../../hooks/useRemote.js";
import { dateTimeLabel } from "../../config/sections.js";

function Pager({ page, pages, onChange }) {
  return (
    <div className="admin-table-footer">
      <span>
        Page {page} sur {Math.max(1, pages)}
      </span>
      <div>
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente">
          <ChevronLeft size={17} />
        </button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
const statusTone = (status) => (status >= 500 ? "closed" : status >= 400 ? "new" : "confirmed");

function Overview() {
  const { data, error } = useRemote("/system/security/overview");
  return (
    <>
      <Alert error={error} />
      <StatGrid
        loading={!data}
        items={
          data
            ? [
                { icon: Users, label: "Comptes actifs", value: data.users.active, note: `${data.users.admins} administrateur(s) général(aux)` },
                { icon: MonitorSmartphone, label: "Sessions ouvertes", value: data.sessions, note: "Tous comptes confondus", tone: "blue" },
                { icon: ShieldAlert, label: "Échecs de connexion (24 h)", value: data.failures24h, note: `${data.failures7d} sur 7 jours · ${data.locked} identifiant(s) bloqué(s)`, tone: "pink" },
                { icon: Activity, label: "Appels API (24 h)", value: data.calls24h, note: `${data.forbidden24h} refus · ${data.errors24h} erreur(s) serveur`, tone: "green" },
              ]
            : []
        }
      />
      <div className="dashboard-grid dashboard-grid-wide">
        <Panel title="API les plus utilisées" subtitle="7 derniers jours">
          <SimpleTable
            rows={data?.endpoints}
            rowKey={(row) => `${row.method} ${row.path}`}
            columns={[
              { label: "Méthode", render: (row) => <code className="method-tag">{row.method}</code> },
              { label: "Route", render: (row) => <code>{row.path}</code> },
              { label: "Appels", align: "right", render: (row) => row.count },
              { label: "Erreurs", align: "right", render: (row) => row.errors },
              { label: "Temps moyen", align: "right", render: (row) => `${row.ms} ms` },
            ]}
          />
        </Panel>
        <Panel title="Activité par compte" subtitle="7 derniers jours">
          <SimpleTable
            rows={data?.perUser}
            rowKey={(row) => row.username}
            columns={[
              { label: "Compte", render: (row) => `@${row.username}` },
              { label: "Appels", align: "right", render: (row) => row.count },
              { label: "Modifications", align: "right", render: (row) => row.writes },
              { label: "Dernier", render: (row) => dateTimeLabel(row.last) },
            ]}
          />
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Dernières connexions réussies">
          <SecurityEvents items={data?.logins.map((item) => ({ ...item, event: "login_success" }))} />
        </Panel>
        <Panel title="Échecs de connexion par adresse IP" subtitle="7 derniers jours">
          <SimpleTable
            rows={data?.failuresByIp}
            rowKey={(row) => row.ip}
            empty={<p className="dashboard-zero">Aucun échec de connexion cette semaine.</p>}
            columns={[
              { label: "Adresse IP", render: (row) => <code>{row.ip}</code> },
              { label: "Échecs", align: "right", render: (row) => row.count },
              { label: "Dernier", render: (row) => dateTimeLabel(row.last) },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function Events() {
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState("");
  const [username, setUsername] = useState("");
  const { data, error } = useRemote(
    `/system/security/events?page=${page}&event=${event}&username=${encodeURIComponent(username)}`,
    { delay: 200 },
  );
  return (
    <>
      <Alert error={error} />
      <div className="admin-resource-bar">
        <div>
          <strong>{data?.total ?? 0}</strong>
          <span>événements (conservés 180 jours)</span>
        </div>
        <select value={event} onChange={(e) => { setEvent(e.target.value); setPage(1); }} aria-label="Type d’événement">
          <option value="">Tous les événements</option>
          {Object.entries(eventLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <label className="admin-search">
          <input value={username} placeholder="Nom d’utilisateur exact" onChange={(e) => { setUsername(e.target.value); setPage(1); }} />
        </label>
      </div>
      <Panel>
        <SecurityEvents items={data?.items} />
        <Pager page={page} pages={data?.pages || 1} onChange={setPage} />
      </Panel>
    </>
  );
}

function Sessions() {
  const { data, error, reload } = useRemote("/system/security/sessions");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  async function revoke(session) {
    if (!window.confirm(`Fermer la session de ${session.user?.name || "ce compte"} (${session.device}) ?`)) return;
    try {
      await adminApi(`/system/security/sessions/${session.id}`, { method: "DELETE" });
      setMessage("Session fermée.");
      setFailure("");
      reload();
    } catch (problem) {
      setFailure(problem.message);
    }
  }
  return (
    <>
      <Alert error={error || failure} success={message} />
      <Panel title="Sessions ouvertes" subtitle="Déconnexion automatique après 30 min d’inactivité">
        <SimpleTable
          rows={data?.items}
          rowKey={(row) => row.id}
          empty={<p className="dashboard-zero">Aucune session ouverte.</p>}
          columns={[
            { label: "Compte", render: (row) => (row.user ? `${row.user.name} (@${row.user.username})` : "Compte supprimé") },
            { label: "Appareil", render: (row) => <>{row.device}{row.current && <em className="chip">Cet appareil</em>}</> },
            { label: "Adresse IP", render: (row) => <code>{row.ip || "—"}</code> },
            { label: "Connecté le", render: (row) => dateTimeLabel(row.createdAt) },
            { label: "Dernière activité", render: (row) => dateTimeLabel(row.lastSeenAt) },
            {
              label: "Action",
              render: (row) =>
                !row.current && (
                  <button className="panel-action" onClick={() => revoke(row)}>
                    <LogOut size={14} /> Fermer
                  </button>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function ApiCalls() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ username: "", status: "", method: "", q: "" });
  const query = new URLSearchParams({ page: String(page), ...filters }).toString();
  const { data, error } = useRemote(`/system/security/api?${query}`, { delay: 200 });
  const set = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    setPage(1);
  };
  return (
    <>
      <Alert error={error} />
      <div className="admin-resource-bar">
        <div>
          <strong>{data?.total ?? 0}</strong>
          <span>appels (conservés 30 jours)</span>
        </div>
        <label className="admin-search">
          <input value={filters.q} placeholder="Route contenant…" onChange={set("q")} />
        </label>
        <label className="admin-search">
          <input value={filters.username} placeholder="Nom d’utilisateur exact" onChange={set("username")} />
        </label>
        <select value={filters.method} onChange={set("method")} aria-label="Méthode">
          <option value="">Toutes les méthodes</option>
          {["GET", "POST", "PATCH", "PUT", "DELETE"].map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
        <select value={filters.status} onChange={set("status")} aria-label="Résultat">
          <option value="">Tous les résultats</option>
          <option value="errors">Erreurs (4xx et 5xx)</option>
          <option value="denied">Accès refusés (401, 403)</option>
          <option value="server">Erreurs serveur (5xx)</option>
        </select>
      </div>
      <Panel>
        <SimpleTable
          rows={data?.items}
          columns={[
            { label: "Date", render: (row) => dateTimeLabel(row.createdAt) },
            { label: "Compte", render: (row) => (row.username ? `@${row.username}` : <span className="cell-note">Non connecté</span>) },
            { label: "Méthode", render: (row) => <code className="method-tag">{row.method}</code> },
            { label: "Route", render: (row) => <code>{row.path}</code> },
            { label: "Statut", render: (row) => <span className={`admin-status status-${statusTone(row.status)}`}>{row.status}</span> },
            { label: "Durée", align: "right", render: (row) => `${row.ms} ms` },
            { label: "Adresse IP", render: (row) => <code>{row.ip}</code> },
          ]}
        />
        <Pager page={page} pages={data?.pages || 1} onChange={setPage} />
      </Panel>
    </>
  );
}

export default function GlobalSecurityPage() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <PageHeading
        kicker="ADMINISTRATION GÉNÉRALE"
        title="Sécurité de l’application"
        description="Qui se connecte, d’où, avec quel appareil, et quelles API sont utilisées par chaque compte."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["overview", "Vue d’ensemble"],
          ["events", "Connexions et événements"],
          ["sessions", "Sessions ouvertes"],
          ["api", "Appels API"],
        ]}
      />
      {tab === "overview" && <Overview />}
      {tab === "events" && <Events />}
      {tab === "sessions" && <Sessions />}
      {tab === "api" && <ApiCalls />}
      <p className="panel-note page-note">
        <ShieldX size={15} /> Les mots de passe ne sont jamais enregistrés en clair ni affichés.
        <ServerCrash size={15} /> Les erreurs serveur ne révèlent aucun détail technique aux visiteurs.
      </p>
    </>
  );
}
