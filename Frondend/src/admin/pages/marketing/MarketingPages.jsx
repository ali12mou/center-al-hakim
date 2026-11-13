import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  Globe,
  History,
  KeyRound,
  Link2,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Power,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import Dialog from "../../../components/Dialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import FormDialog from "../../components/FormDialog.jsx";
import { Alert, Panel, PersonCell, SimpleTable, StatGrid } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useLookup, useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel } from "../../lib/format.js";
import { dateTimeLabel } from "../../config/sections.js";
import {
  PROSPECT_STATUS,
  PROSPECT_TONE,
  PROSPECT_SOURCES,
  OPEN_STATUSES,
} from "../../../../../Backend/config/marketing.js";
import "./marketing-admin.css";

const portalUrl = () => `${window.location.origin}/marketings`;
const AGENTS = "centre.marketingAgents";
const PROSPECTS = "centre.prospects";

// Numéro au format WhatsApp : 8 chiffres à Djibouti → indicatif 253 ajouté.
function whatsappNumber(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `253${digits}`;
  return digits.length >= 10 ? digits : "";
}
function ProspectStatus({ status }) {
  return <span className={`admin-status status-${PROSPECT_TONE[status] || "new"}`}>{PROSPECT_STATUS[status] || status}</span>;
}
function CopyButton({ text, label = "Copier" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button button-outline button-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />} {copied ? "Copié" : label}
    </button>
  );
}
function PortalBanner() {
  return (
    <div className="app-share-banner marketing-portal-banner">
      <Globe size={20} />
      <span>
        Portail des agents marketing : <b>{portalUrl()}</b>
        <small>Les agents s’y connectent avec leur adresse e-mail et leur mot de passe. Ils ne voient que leurs propres prospects.</small>
      </span>
      <CopyButton text={portalUrl()} label="Copier l’adresse" />
    </div>
  );
}

// ——————————————————— Agents marketing ———————————————————

// Identifiants affichés une seule fois : le mot de passe n’est jamais conservé en clair.
function CredentialsDialog({ value, onClose }) {
  const message = `Bonjour ${value.name},\nVotre compte d’agent marketing AL-HAKIM CENTER est prêt.\n\nPortail : ${portalUrl()}/login\nE-mail : ${value.email}\nMot de passe provisoire : ${value.password}\n\nÀ la première connexion, choisissez votre mot de passe personnel.`;
  const phone = whatsappNumber(value.phone);
  return (
    <Dialog title="Identifiants de l’agent" onClose={onClose} className="admin-editor">
      <p className="editor-intro">
        Remettez ces informations à <b>{value.name}</b>. Le mot de passe provisoire ne sera plus affiché. L’agent devra le
        remplacer à sa première connexion.
      </p>
      <dl className="mini-facts credentials-facts">
        <div>
          <dt>Portail</dt>
          <dd>{portalUrl()}/login</dd>
        </div>
        <div>
          <dt>E-mail de connexion</dt>
          <dd>
            <code>{value.email}</code>
          </dd>
        </div>
        <div>
          <dt>Mot de passe provisoire</dt>
          <dd>
            <code>{value.password}</code>
          </dd>
        </div>
      </dl>
      <div className="admin-editor-actions">
        <CopyButton text={message} label="Copier le message" />
        {phone && (
          <a className="button" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> Envoyer par WhatsApp
          </a>
        )}
        <button type="button" className="button button-outline" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Dialog>
  );
}

function ActivityDialog({ agent, onClose }) {
  const { data, error, busy } = useRemote(`/marketing/agents/${agent._id}/activity`);
  return (
    <Dialog title={`Activité · ${agent.name}`} onClose={onClose} className="admin-editor admin-editor-wide">
      <dl className="mini-facts">
        <div>
          <dt>Identifiant</dt>
          <dd>{agent.reference}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{agent.email}</dd>
        </div>
        <div>
          <dt>Téléphone</dt>
          <dd>{agent.phone || "—"}</dd>
        </div>
        <div>
          <dt>Prospects collectés</dt>
          <dd>
            {agent.prospects} · {agent.enrolled} inscrit{agent.enrolled > 1 ? "s" : ""}
          </dd>
        </div>
        <div>
          <dt>Dernière connexion</dt>
          <dd>{agent.lastLoginAt ? dateTimeLabel(agent.lastLoginAt) : "Jamais"}</dd>
        </div>
      </dl>
      <Alert error={error} />
      <h3 className="form-heading">Historique des activités</h3>
      <SimpleTable
        rows={data?.items || []}
        empty={<p className="dashboard-zero">{busy ? "Chargement…" : "Aucune activité pour le moment."}</p>}
        columns={[
          { label: "Date", render: (row) => dateTimeLabel(row.createdAt) },
          { label: "Action", render: (row) => row.label },
          { label: "Détail", render: (row) => row.details || "—" },
          { label: "Adresse IP", render: (row) => row.ip || "—" },
        ]}
      />
    </Dialog>
  );
}

const agentFields = (record) => [
  { key: "name", label: "Nom complet", required: true, placeholder: "Prénom et nom" },
  { key: "phone", label: "Numéro de téléphone", type: "tel", placeholder: "+253 77 00 00 00" },
  { key: "email", label: "Adresse e-mail", type: "email", required: true, hint: "Sert d’identifiant de connexion au portail." },
  !record && {
    key: "password",
    label: "Mot de passe initial",
    type: "password",
    hint: "12 caractères minimum, 3 types (minuscules, majuscules, chiffres, symboles). Laissez vide pour générer un mot de passe provisoire.",
  },
  {
    key: "active",
    label: "Statut du compte",
    type: "select",
    options: [
      ["true", "Actif"],
      ["false", "Inactif"],
    ],
  },
].filter(Boolean);
const agentBody = (body) => ({ ...body, active: body.active !== "false", ...(body.password ? {} : { password: undefined }) });

export function AgentsPage() {
  const admin = useAdmin();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const refresh = (message) => {
    setNotice(message);
    setVersion((value) => value + 1);
  };
  return (
    <>
      <ListPage
        key={version}
        kicker="GESTION DU CENTRE · MARKETING ET PROSPECTION"
        title="Agents marketing"
        description="Créez, modifiez, activez ou désactivez les comptes des agents marketing. Chaque agent a un identifiant unique, un compte personnel et un historique de ses activités."
        endpoint="/marketing/agents"
        section={AGENTS}
        search="Nom, téléphone, e-mail…"
        creatable={false}
        filters={[{ key: "active", label: "Statut", options: [["", "Tous les agents"], ["true", "Actifs"], ["false", "Inactifs"]] }]}
        exportName="agents-marketing"
        headerActions={() =>
          admin.can(AGENTS, "create") && (
            <button className="button" onClick={() => setCreating(true)}>
              <Plus size={17} /> Ajouter un agent marketing
            </button>
          )
        }
        deleteConfirm={(item) => `Supprimer le compte de ${item.name} ? (Possible seulement s’il n’a collecté aucun prospect.)`}
        actions={(item, ctx) => [
          { icon: Eye, label: "Voir", onClick: () => setViewing(item) },
          admin.can(AGENTS, "update") && {
            icon: KeyRound,
            label: "Réinitialiser le mot de passe",
            onClick: () => setResetting(item),
          },
          admin.can(AGENTS, "update") && {
            icon: Power,
            label: item.active ? "Désactiver" : "Activer",
            tone: item.active ? "delete" : undefined,
            onClick: () =>
              ctx.run(
                () => adminApi(`/marketing/agents/${item._id}`, { method: "PATCH", body: { active: !item.active } }),
                item.active ? `${item.name} est désactivé et déconnecté du portail.` : `${item.name} est de nouveau actif.`,
              ),
          },
        ]}
        columns={[
          { label: "Nom complet", render: (item) => <PersonCell name={item.name} detail={item.reference} />, csv: (item) => item.name },
          { label: "Téléphone", render: (item) => item.phone || "À renseigner", csv: (item) => item.phone },
          { label: "E-mail", render: (item) => item.email, csv: (item) => item.email },
          { label: "Prospects collectés", align: "right", render: (item) => <strong>{item.prospects}</strong>, csv: (item) => item.prospects },
          { label: "Inscriptions", align: "right", render: (item) => item.enrolled, csv: (item) => item.enrolled },
          {
            label: "Dernière connexion",
            render: (item) => (item.lastLoginAt ? dateTimeLabel(item.lastLoginAt) : "Jamais"),
            csv: (item) => item.lastLoginAt || "",
          },
          {
            label: "Statut",
            render: (item) =>
              !item.active ? (
                <span className="admin-status status-closed">Inactif</span>
              ) : item.mustChangePassword ? (
                <span className="admin-status status-new">Actif · mot de passe provisoire</span>
              ) : (
                <span className="admin-status status-confirmed">Actif</span>
              ),
            csv: (item) => (item.active ? "Actif" : "Inactif"),
          },
        ]}
        form={{
          title: "agent marketing",
          fields: agentFields,
          initial: (record) => ({ ...record, active: String(record.active) }),
          toBody: agentBody,
        }}
      >
        <PortalBanner />
        {notice && <Alert success={notice} />}
      </ListPage>
      {creating && (
        <FormDialog
          title="Ajouter un agent marketing"
          intro="Le mot de passe est chiffré (haché) sur le serveur : il n’est jamais affiché dans les tableaux ni conservé en clair."
          fields={agentFields(null)}
          initial={{ active: "true" }}
          submitLabel="Créer le compte"
          onClose={() => setCreating(false)}
          onSubmit={async (body) => {
            const result = await adminApi("/marketing/agents", { method: "POST", body: agentBody(body) });
            setCreating(false);
            refresh(`Compte de ${result.item.name} créé (${result.item.reference}).`);
            if (result.temporaryPassword)
              setCredentials({ ...result.item, password: result.temporaryPassword });
          }}
        />
      )}
      {resetting && (
        <FormDialog
          title={`Nouveau mot de passe · ${resetting.name}`}
          intro="L’ancien mot de passe n’est pas nécessaire. L’agent est déconnecté et devra choisir son mot de passe personnel à la prochaine connexion."
          fields={[
            {
              key: "password",
              label: "Nouveau mot de passe",
              type: "password",
              hint: "Laissez vide pour générer un mot de passe provisoire.",
            },
          ]}
          submitLabel="Réinitialiser"
          onClose={() => setResetting(null)}
          onSubmit={async (body) => {
            const result = await adminApi(`/marketing/agents/${resetting._id}/password`, {
              method: "POST",
              body: body.password ? body : {},
            });
            const agent = resetting;
            setResetting(null);
            refresh(result.message);
            if (result.temporaryPassword) setCredentials({ ...agent, password: result.temporaryPassword });
          }}
        />
      )}
      {viewing && <ActivityDialog agent={viewing} onClose={() => setViewing(null)} />}
      {credentials && <CredentialsDialog value={credentials} onClose={() => setCredentials(null)} />}
    </>
  );
}

// ——————————————————— Collecte des prospects ———————————————————

function useAgents() {
  const { data } = useRemote("/marketing/agents-lookup");
  return data?.items || [];
}

function ProspectStats({ filters }) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([key, value]) => value && key !== "status"),
  ).toString();
  const { data, busy } = useRemote(`/marketing/stats?${params}`, { delay: 150 });
  return (
    <>
      <StatGrid
        loading={busy && !data}
        items={[
          { icon: Users, label: "Prospects collectés", value: data?.total ?? 0, note: "Nombre total", tone: "navy" },
          { icon: Target, label: "Prospects intéressés", value: data?.interested ?? 0, note: "Intérêt confirmé", tone: "blue" },
          {
            icon: UserCheck,
            label: "Inscriptions réalisées",
            value: data?.enrolled ?? 0,
            note: `Conversion : ${String(data?.conversion ?? 0).replace(".", ",")} %`,
            tone: "green",
          },
          { icon: PhoneCall, label: "Relances à effectuer", value: data?.followUps ?? 0, note: "Suivi quotidien", tone: "pink" },
        ]}
      />
      {data?.byAgent?.length > 0 && (
        <Panel title="Performance des agents" subtitle="Sur la période et les filtres choisis (hors filtre de statut).">
          <SimpleTable
            rows={data.byAgent}
            rowKey={(row) => row.agentId || "admin"}
            columns={[
              { label: "Agent", render: (row) => <strong>{row.name}</strong> },
              { label: "Prospects", render: (row) => row.total },
              { label: "Intéressés", render: (row) => row.interested },
              { label: "Inscrits", render: (row) => row.enrolled },
              { label: "Non intéressés", render: (row) => row.lost },
              {
                label: "Conversion",
                render: (row) => (
                  <span className="marketing-rate">
                    <i style={{ width: `${Math.min(100, row.conversion)}%` }} />
                    <b>{String(row.conversion).replace(".", ",")} %</b>
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      )}
    </>
  );
}

function ContactDialog({ prospect, onClose }) {
  const phone = whatsappNumber(prospect.phone);
  const text = `Bonjour ${prospect.name}, ici AL-HAKIM CENTER. Suite à votre intérêt pour la formation « ${prospect.courseTitle} », nous souhaitons vous donner plus d’informations.`;
  return (
    <Dialog title={`Contacter · ${prospect.name}`} onClose={onClose} className="admin-editor">
      <div className="marketing-contact">
        <a className="button" href={`tel:${prospect.phone.replace(/[^\d+]/g, "")}`}>
          <Phone size={16} /> Appeler {prospect.phone}
        </a>
        {phone && (
          <a className="button button-outline" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
        )}
        {prospect.email && (
          <a
            className="button button-outline"
            href={`mailto:${prospect.email}?subject=${encodeURIComponent("AL-HAKIM CENTER — " + prospect.courseTitle)}&body=${encodeURIComponent(text)}`}
          >
            <Mail size={16} /> E-mail
          </a>
        )}
      </div>
      {!prospect.consent && (
        <p className="admin-error">Ce prospect n’a pas donné son accord pour recevoir des messages commerciaux : limitez-vous au suivi de sa demande.</p>
      )}
    </Dialog>
  );
}

function HistoryDialog({ prospect, onClose }) {
  const { data, error, busy } = useRemote(`/marketing/prospects/${prospect._id}/history`);
  return (
    <Dialog title={`${prospect.reference} · ${prospect.name}`} onClose={onClose} className="admin-editor admin-editor-wide">
      <dl className="mini-facts">
        <div>
          <dt>Téléphone</dt>
          <dd>{prospect.phone}</dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{prospect.email || "—"}</dd>
        </div>
        <div>
          <dt>Formation</dt>
          <dd>{prospect.courseTitle}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{PROSPECT_SOURCES[prospect.source]}</dd>
        </div>
        <div>
          <dt>Agent marketing</dt>
          <dd>{prospect.agentName || "Administration"}</dd>
        </div>
        <div>
          <dt>Collecté le</dt>
          <dd>{dateTimeLabel(prospect.createdAt)}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>
            <ProspectStatus status={prospect.status} />
          </dd>
        </div>
        <div>
          <dt>Prochaine relance</dt>
          <dd>{prospect.nextFollowUp ? dayLabel(prospect.nextFollowUp) : "—"}</dd>
        </div>
        <div>
          <dt>Inscrit relié</dt>
          <dd>{prospect.registrationReference || "—"}</dd>
        </div>
        <div>
          <dt>Accord communications</dt>
          <dd>{prospect.consent ? "Oui" : "Non"}</dd>
        </div>
      </dl>
      {prospect.notes && <p className="editor-intro">{prospect.notes}</p>}
      <Alert error={error} />
      <h3 className="form-heading">Historique des statuts</h3>
      <SimpleTable
        rows={data?.items || []}
        empty={<p className="dashboard-zero">{busy ? "Chargement…" : "Aucun changement."}</p>}
        columns={[
          { label: "Date", render: (row) => dateTimeLabel(row.createdAt) },
          {
            label: "Statut",
            render: (row) => (
              <span className="marketing-transition">
                {row.from ? <>{PROSPECT_STATUS[row.from]} → </> : null}
                <ProspectStatus status={row.to} />
              </span>
            ),
          },
          { label: "Par", render: (row) => `${row.by?.name || "—"}${row.by?.kind === "admin" ? " (administration)" : ""}` },
          { label: "Commentaire", render: (row) => row.note || "—" },
          { label: "Relance", render: (row) => (row.nextFollowUp ? dayLabel(row.nextFollowUp) : "—") },
        ]}
      />
    </Dialog>
  );
}

const statusOptions = Object.entries(PROSPECT_STATUS);
const sourceOptions = Object.entries(PROSPECT_SOURCES);

export function ProspectsPage() {
  const admin = useAdmin();
  const agents = useAgents();
  const courses = useLookup("courses");
  const [dialog, setDialog] = useState(null);
  const agentOptions = useMemo(
    () => [["", "— Administration (aucun agent) —"], ...agents.map((agent) => [agent._id, `${agent.name}${agent.active ? "" : " (inactif)"}`])],
    [agents],
  );
  const close = () => setDialog(null);
  return (
    <>
      <ListPage
        kicker="GESTION DU CENTRE · MARKETING ET PROSPECTION"
        title="Collecte des prospects"
        description="Toutes les personnes intéressées par les formations, collectées par les agents marketing. Chaque changement de statut est daté et historisé avec son auteur."
        endpoint="/marketing/prospects"
        section={PROSPECTS}
        search="Nom, téléphone, e-mail, ID…"
        createLabel="Ajouter un prospect"
        exportName="prospects-marketing"
        filters={[
          {
            key: "status",
            label: "Statut",
            options: [["", "Tous les statuts"], ["followup", "Relances à effectuer"], ...statusOptions],
          },
          { key: "agentId", label: "Agent", options: [["", "Tous les agents"], ["none", "Administration"], ...agents.map((agent) => [agent._id, agent.name])] },
          { key: "courseId", label: "Formation", options: [["", "Toutes les formations"], ...courses.map((course) => [course.id, course.title])] },
          { key: "source", label: "Source", options: [["", "Toutes les sources"], ...sourceOptions] },
          { key: "from", label: "Du" },
          { key: "to", label: "Au" },
        ]}
        deleteConfirm={(item) => `Supprimer le prospect ${item.name} (${item.reference}) et son historique ?`}
        actions={(item) => [
          { icon: Eye, label: "Voir", onClick: () => setDialog({ kind: "history", item }) },
          { icon: Phone, label: "Contacter", onClick: () => setDialog({ kind: "contact", item }) },
          admin.can(PROSPECTS, "update") && {
            icon: ListChecks,
            label: "Changer le statut",
            onClick: (_item, ctx) => setDialog({ kind: "status", item, ctx }),
          },
          admin.can(PROSPECTS, "update") &&
            !item.registrationId && {
              icon: Link2,
              label: "Relier à un inscrit",
              onClick: (_item, ctx) => setDialog({ kind: "link", item, ctx }),
            },
        ]}
        columns={[
          { label: "ID", render: (item) => <span className="record-id">{item.reference}</span>, csv: (item) => item.reference },
          { label: "Nom complet", render: (item) => <strong>{item.name}</strong>, csv: (item) => item.name },
          { label: "Téléphone", render: (item) => item.phone, csv: (item) => item.phone },
          { label: "E-mail", render: (item) => item.email || "—", csv: (item) => item.email },
          { label: "Formation", render: (item) => item.courseTitle, csv: (item) => item.courseTitle },
          { label: "Date", render: (item) => dateTimeLabel(item.createdAt), csv: (item) => item.createdAt },
          { label: "Agent marketing", render: (item) => item.agentName || "Administration", csv: (item) => item.agentName || "Administration" },
          {
            label: "Statut",
            render: (item) => (
              <span className="marketing-status-cell">
                <ProspectStatus status={item.status} />
                {item.registrationReference && <small>Inscrit {item.registrationReference}</small>}
                {!item.registrationReference && item.nextFollowUp && OPEN_STATUSES.includes(item.status) && (
                  <small>Relance {dayLabel(item.nextFollowUp)}</small>
                )}
              </span>
            ),
            csv: (item) => PROSPECT_STATUS[item.status],
          },
          { label: "Source", render: (item) => PROSPECT_SOURCES[item.source], csv: (item) => PROSPECT_SOURCES[item.source] },
        ]}
        form={{
          title: "prospect",
          wide: true,
          fields: (record) =>
            [
              { key: "name", label: "Nom complet", required: true },
              { key: "phone", label: "Téléphone", type: "tel", required: true, placeholder: "77 00 00 00" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "courseId", label: "Compétence ou formation souhaitée", type: "lookup", lookup: "courses", valueKey: "id", required: true, placeholder: "Choisir une formation" },
              !record && { key: "status", label: "Statut", type: "select", options: statusOptions },
              { key: "source", label: "Source", type: "select", options: sourceOptions },
              { key: "agentId", label: "Agent marketing", type: "select", options: agentOptions },
              { key: "nextFollowUp", label: "Prochaine relance", type: "date" },
              { key: "consent", label: "Accord pour recevoir les informations du centre", type: "checkbox", hint: "Consentement aux communications commerciales." },
              { key: "notes", label: "Observations", type: "textarea" },
            ].filter(Boolean),
          initial: (record) => ({ ...record, agentId: record.agentId || "" }),
        }}
      >
        {(ctx) => <ProspectStats filters={ctx.filters} />}
      </ListPage>
      {dialog?.kind === "history" && <HistoryDialog prospect={dialog.item} onClose={close} />}
      {dialog?.kind === "contact" && <ContactDialog prospect={dialog.item} onClose={close} />}
      {dialog?.kind === "status" && (
        <FormDialog
          title={`Changer le statut · ${dialog.item.name}`}
          intro={`Statut actuel : ${PROSPECT_STATUS[dialog.item.status]}. La date, l’auteur et le commentaire sont enregistrés dans l’historique.`}
          fields={[
            { key: "status", label: "Nouveau statut", type: "select", options: statusOptions },
            { key: "nextFollowUp", label: "Prochaine relance", type: "date", show: (values) => OPEN_STATUSES.includes(values.status) },
            { key: "note", label: "Commentaire", type: "textarea" },
          ]}
          initial={{ status: dialog.item.status, nextFollowUp: dialog.item.nextFollowUp }}
          submitLabel="Enregistrer le statut"
          onClose={close}
          onSubmit={async (body) => {
            const result = await adminApi(`/marketing/prospects/${dialog.item._id}/status`, { method: "POST", body });
            const ctx = dialog.ctx;
            close();
            ctx.done(
              result.item.registrationReference && !dialog.item.registrationReference
                ? `Statut enregistré. Prospect relié à l’inscrit ${result.item.registrationReference}.`
                : "Statut enregistré.",
            );
          }}
        />
      )}
      {dialog?.kind === "link" && (
        <FormDialog
          title={`Relier à un inscrit · ${dialog.item.name}`}
          intro="Choisissez son dossier dans Gestion du centre › Inscrits. S’il n’y figure pas, l’inscrit est créé à partir des informations du prospect, sans ressaisie."
          fields={[
            {
              key: "registrationId",
              label: "Inscrit",
              type: "lookup",
              lookup: "registrations",
              wide: true,
              placeholder: "— Créer l’inscrit à partir du prospect —",
              optionLabel: (item) => `${item.name} · ${item.phone || "—"} · ${item.reference}`,
            },
          ]}
          submitLabel="Relier"
          onClose={close}
          onSubmit={async (body) => {
            const result = await adminApi(`/marketing/prospects/${dialog.item._id}/link`, {
              method: "POST",
              body: body.registrationId ? { registrationId: body.registrationId } : { create: true },
            });
            const ctx = dialog.ctx;
            close();
            ctx.done(`Prospect relié à l’inscrit ${result.item.registrationReference}.`);
          }}
        />
      )}
    </>
  );
}

