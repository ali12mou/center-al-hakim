import { useState } from "react";
import { Check, Copy, KeyRound, Link as LinkIcon, MessageCircle, Power, Search, ShieldCheck, Smartphone, UserPlus } from "lucide-react";
import "./access.css";
import Dialog from "../../../components/Dialog.jsx";
import ListPage from "../../components/ListPage.jsx";
import { Alert, PageHeading, Panel, PersonCell, SimpleTable, StatusPill, Tabs } from "../../components/ui.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { adminApi } from "../../services/adminApi.js";
import { dayLabel } from "../../lib/format.js";
import { dateTimeLabel } from "../../config/sections.js";

export const appUrl = () => `${window.location.origin}/etudiant`;

// Numéro au format WhatsApp : 8 chiffres à Djibouti → indicatif 253 ajouté.
function whatsappNumber(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `253${digits}`;
  return digits.length >= 10 ? digits : "";
}

// Identifiants affichés une seule fois : le mot de passe n’est pas conservé en clair.
export function CredentialsDialog({ value, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const message = `Bonjour ${value.name},\nVotre espace student AL-HAKIM CENTER est prêt.\n\nApplication : ${appUrl()}\nIdentifiant : ${value.username}\nMot de passe provisoire : ${value.password}\n\nÀ la première connexion, choisissez votre mot de passe personnel. Vous pouvez ensuite installer l’application sur votre téléphone.`;
  const phone = whatsappNumber(value.phone);
  async function copy() {
    try {
      setCopyError("");
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError("La copie est indisponible. Sélectionnez les informations ci-dessous pour les copier manuellement.");
    }
  }
  return (
    <Dialog title="L’accès de l’élève est prêt" onClose={onClose} className="admin-editor student-credentials">
      <span className="credentials-ready"><ShieldCheck size={17} /> À remettre à l’élève</span>
      <p className="editor-intro">
        Remettez ces informations à <b>{value.name}</b>. Le mot de passe provisoire ne sera plus affiché : notez-le ou
        envoyez-le maintenant. L’élève devra le remplacer à sa première connexion.
      </p>
      <dl className="student-credentials-grid">
        <div>
          <dt><LinkIcon size={15} /> Adresse de connexion</dt>
          <dd><a href={appUrl()} target="_blank" rel="noopener noreferrer">{appUrl()}</a></dd>
        </div>
        <div>
          <dt><UserPlus size={15} /> Identifiant</dt>
          <dd>
            <code>{value.username}</code>
          </dd>
        </div>
        <div>
          <dt><KeyRound size={15} /> Mot de passe provisoire</dt>
          <dd>
            <code>{value.password}</code>
          </dd>
        </div>
      </dl>
      <p className="credentials-security"><ShieldCheck size={16} /> Ce mot de passe devra être remplacé à la première connexion.</p>
      {copyError && <p role="alert" className="credentials-copy-error">{copyError}</p>}
      <div className="admin-editor-actions">
        <button type="button" className="button button-outline" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Accès copiés" : "Copier les accès"}
        </button>
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

// Students (dossiers financiers) qui n’ont pas encore d’accès à l’application.
function WithoutAccess({ onCreated }) {
  const admin = useAdmin();
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const { data, error: loadError, reload } = useRemote(`/eleves/students?q=${encodeURIComponent(q)}`, { delay: 200 });
  const rows = (data?.items || []).filter((item) => !item.access);
  async function create(item) {
    setBusy(item._id);
    setError("");
    try {
      const result = await adminApi("/eleves/access", { method: "POST", body: { accountIds: [item._id] } });
      onCreated({ name: result.item.name, username: result.item.username, password: result.temporaryPassword, phone: result.item.phone });
      reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Alert error={error || loadError} />
      <div className="admin-resource-bar">
        <div>
          <strong>{rows.length}</strong>
          <span>student{rows.length > 1 ? "s" : ""} sans accès</span>
        </div>
        <label className="admin-search">
          <Search size={17} />
          <input value={q} placeholder="Nom, téléphone ou n° de dossier…" onChange={(event) => setQ(event.target.value)} />
        </label>
      </div>
      <Panel subtitle="La liste vient des dossiers de students (Finances › Échéanciers). Créez d’abord le dossier du student s’il n’y figure pas.">
        <SimpleTable
          rows={rows}
          empty={<p className="dashboard-zero">Tous les students ont déjà un accès, ou aucun dossier ne correspond.</p>}
          columns={[
            { label: "Student", render: (row) => <PersonCell name={row.studentName} detail={row.phone || row.email} /> },
            { label: "Dossier", render: (row) => <span className="record-id">{row.reference}</span> },
            { label: "Formation", render: (row) => row.courseTitle || "—" },
            { label: "Début", render: (row) => dayLabel(row.startDate) },
            {
              label: "",
              render: (row) =>
                admin.can("eleves.access", "create") && (
                  <button className="panel-action" disabled={busy === row._id} onClick={() => create(row)}>
                    <UserPlus size={14} /> {busy === row._id ? "Création…" : "Créer l’accès"}
                  </button>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

export default function AccessPage() {
  const admin = useAdmin();
  const [tab, setTab] = useState("access");
  const [credentials, setCredentials] = useState(null);
  const [version, setVersion] = useState(0);
  return (
    <div className="student-access-page">
      <PageHeading
        kicker="ESPACE ÉLÈVES · APPLICATION MOBILE"
        title="Accès à l’application"
        description="Chaque student se connecte à l’application avec un identifiant et un mot de passe donnés par le centre. Il ne voit que ses formations, ses cours, ses présences, ses notes et ses paiements — jamais l’administration."
      />
      <div className="app-share-banner">
        <span className="student-app-icon"><Smartphone size={26} strokeWidth={1.5} /></span>
        <span>
          <span className="student-app-kicker">LEUR ESPACE PERSONNEL</span><b>{appUrl()}</b>
          <small>Sur Android, Chrome propose « Installer l’application ». Sur iPhone : Partager › « Sur l’écran d’accueil ».</small>
        </span>
      </div>
      <div className="student-access-steps" aria-label="Créer et remettre un accès">
        <div><span>01</span><strong>Choisir l’élève</strong><small>Depuis les dossiers sans accès</small></div>
        <div><span>02</span><strong>Créer ses identifiants</strong><small>Un accès personnel à ses informations</small></div>
        <div><span>03</span><strong>Remettre les accès</strong><small>Copier le message ou ouvrir WhatsApp</small></div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["access", "Accès créés"],
          ["new", "Élèves sans accès"],
        ]}
      />
      {tab === "new" ? (
        <WithoutAccess
          onCreated={(value) => {
            setCredentials(value);
            setVersion((current) => current + 1);
          }}
        />
      ) : (
        <ListPage
          key={version}
          heading={false}
          endpoint="/eleves/access"
          section="eleves.access"
          search="Nom, identifiant, téléphone…"
          creatable={false}
          filters={[{ key: "active", label: "Statut", options: [["", "Tous les accès"], ["true", "Actifs"], ["false", "Désactivés"]] }]}
          exportName="acces-eleves"
          deleteConfirm={(item) => `Supprimer l’accès de ${item.name} ? Son dossier, ses notes et ses paiements sont conservés.`}
          actions={(item, ctx) => [
            admin.can("eleves.access", "update") && {
              icon: ShieldCheck,
              label: "Révoquer la carte étudiant",
              onClick: () => { if(window.confirm(`Révoquer la carte de ${item.name} ? Le QR code signalera la révocation.`)) ctx.run(()=>adminApi(`/eleves/access/${item._id}/card/revoke`,{method:'POST',body:{}}),'Carte étudiant révoquée.'); },
            },
            admin.can("eleves.access", "update") && {
              icon: KeyRound,
              label: "Nouveau mot de passe provisoire",
              onClick: async () => {
                if (!window.confirm(`Générer un nouveau mot de passe pour ${item.name} ? L’ancien ne fonctionnera plus.`)) return;
                try {
                  const result = await adminApi(`/eleves/access/${item._id}/reset`, { method: "POST" });
                  setCredentials({ name: item.name, username: result.username, password: result.temporaryPassword, phone: item.phone });
                  ctx.reload();
                } catch (failure) {
                  ctx.setError(failure.message);
                }
              },
            },
            admin.can("eleves.access", "update") && {
              icon: Power,
              label: item.active ? "Désactiver l’accès" : "Réactiver l’accès",
              tone: item.active ? "delete" : undefined,
              onClick: () =>
                ctx.run(
                  () => adminApi(`/eleves/access/${item._id}`, { method: "PATCH", body: { active: !item.active } }),
                  item.active ? "Accès désactivé : le student est déconnecté." : "Accès réactivé.",
                ),
            },
          ]}
          columns={[
            { label: "Student", render: (item) => <PersonCell name={item.name} detail={item.phone || item.email} />, csv: (item) => item.name },
            { label: "Identifiant", render: (item) => <code>{item.username}</code>, csv: (item) => item.username },
            {
              label: "Formations",
              render: (item) => item.accounts.map((account) => account.courseTitle || account.reference).join(", ") || "—",
              csv: (item) => item.accounts.map((account) => account.courseTitle).join(", "),
            },
            {
              label: "Dernière connexion",
              render: (item) => (item.lastLoginAt ? dateTimeLabel(item.lastLoginAt) : "Jamais"),
              csv: (item) => item.lastLoginAt || "",
            },
            {
              label: "Statut",
              render: (item) =>
                !item.active ? (
                  <StatusPill status="inactive" label="Désactivé" />
                ) : item.mustChangePassword ? (
                  <StatusPill status="pending" label="Mot de passe provisoire" />
                ) : (
                  <StatusPill status="active" label="Actif" />
                ),
              csv: (item) => (item.active ? "Actif" : "Désactivé"),
            },
          ]}
          form={{
            title: "accès student",
            fields: [
              { key: "name", label: "Nom affiché", required: true },
              { key: "phone", label: "Téléphone", type: "tel" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "photoUrl", label: "Photo de l’élève (URL)", hint:"Image validée par le centre. Elle apparaît sur la carte étudiant." },
            ],
            initial: (record) => record,
          }}
        />
      )}
      {credentials && <CredentialsDialog value={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}
