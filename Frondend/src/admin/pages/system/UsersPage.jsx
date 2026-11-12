import { useState } from "react";
import { Copy, KeyRound, LogOut, Pencil, Power, Trash2, UserPlus } from "lucide-react";
import Dialog from "../../../components/Dialog.jsx";
import FormDialog from "../../components/FormDialog.jsx";
import PermissionMatrix from "../../components/PermissionMatrix.jsx";
import { Alert, Empty, PageHeading, PersonCell } from "../../components/ui.jsx";
import { adminApi } from "../../services/adminApi.js";
import { useRemote } from "../../hooks/useRemote.js";
import { useAdmin } from "../../context/AdminContext.jsx";
import { dateTimeLabel } from "../../config/sections.js";
import { MODULES, ROLES } from "../../../../../Backend/config/permissions.js";

const fields = (record) => [
  { type: "heading", label: "Identité" },
  { key: "name", label: "Nom complet", required: true },
  ...(record ? [] : [{ key: "username", label: "Nom d’utilisateur", required: true, hint: "Pour se connecter. Lettres, chiffres, point ou tiret." }]),
  { key: "email", label: "Adresse e-mail", type: "email", required: true },
  { key: "phone", label: "Téléphone", type: "tel" },
  { key: "jobTitle", label: "Fonction", placeholder: "Ex. : Responsable RH, Comptable, Accueil" },
  { type: "heading", label: "Accès" },
  {
    key: "role",
    label: "Rôle",
    type: "select",
    default: "staff",
    options: [
      ["staff", "Utilisateur : accès limité aux pages cochées"],
      ["admin", "Administrateur général : tous les droits et la gestion des comptes"],
    ],
    wide: true,
  },
  ...(record ? [{ key: "active", label: "Compte actif", type: "checkbox", default: true, hint: "Désactiver ferme aussitôt ses sessions et bloque la connexion." }] : []),
  {
    key: "permissions",
    label: "Pages et actions autorisées",
    type: "custom",
    default: [],
    show: (values) => values.role === "staff",
    render: ({ value, set }) => <PermissionMatrix value={value || []} onChange={set} />,
  },
];

function modulesOf(user) {
  if (user.role === "admin") return ["Tous les modules"];
  return MODULES.filter((module) => user.permissions.some((value) => value.startsWith(`${module.id}.`))).map(
    (module) => module.short,
  );
}

export default function UsersPage() {
  const { user: me } = useAdmin();
  const { data, error: loadError, reload } = useRemote("/system/users");
  const [editor, setEditor] = useState(null);
  const [secret, setSecret] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const items = data?.items || [];
  async function act(task, message) {
    setError("");
    try {
      const result = await task();
      setSuccess(message(result));
      reload();
      return result;
    } catch (failure) {
      setError(failure.message);
      setSuccess("");
    }
  }
  const reset = (user) =>
    window.confirm(`Générer un nouveau mot de passe temporaire pour ${user.name} ? Ses sessions seront fermées.`) &&
    act(
      () => adminApi(`/system/users/${user.id}/reset-password`, { method: "POST" }),
      () => "Mot de passe temporaire généré.",
    ).then((result) => result && setSecret({ user, password: result.temporaryPassword }));
  const revoke = (user) =>
    act(
      () => adminApi(`/system/users/${user.id}/revoke-sessions`, { method: "POST" }),
      (result) => `${result.revoked} session(s) fermée(s) pour ${user.name}.`,
    );
  const toggle = (user) =>
    (user.active || window.confirm(`Réactiver le compte de ${user.name} ?`)) &&
    (!user.active || window.confirm(`Désactiver le compte de ${user.name} ? La personne sera déconnectée immédiatement.`)) &&
    act(
      () => adminApi(`/system/users/${user.id}`, { method: "PATCH", body: { active: !user.active } }),
      () => (user.active ? "Compte désactivé." : "Compte réactivé."),
    );
  const remove = (user) =>
    window.confirm(`Supprimer définitivement le compte de ${user.name} ? Le journal de sécurité est conservé.`) &&
    act(() => adminApi(`/system/users/${user.id}`, { method: "DELETE" }), () => "Compte supprimé.");
  return (
    <>
      <PageHeading
        kicker="ADMINISTRATION GÉNÉRALE"
        title="Utilisateurs et droits"
        description="Créez les comptes du personnel et choisissez, page par page, ce que chacun peut consulter, ajouter, modifier, supprimer ou valider."
      >
        <button className="button" onClick={() => setEditor({ record: null })}>
          <UserPlus size={17} /> Créer un utilisateur
        </button>
      </PageHeading>
      <Alert error={error || loadError} success={success} />
      <div className="admin-table-panel">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Modules</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
                <th className="num">Sessions</th>
                <th className="actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => {
                const self = user.id === me.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <PersonCell name={user.name} detail={`@${user.username} · ${user.email}`} />
                    </td>
                    <td>
                      <span className={user.role === "admin" ? "role-badge is-admin" : "role-badge"}>{ROLES[user.role]}</span>
                      {user.jobTitle && <small className="cell-note">{user.jobTitle}</small>}
                    </td>
                    <td>
                      <div className="chip-list">
                        {modulesOf(user).map((label) => (
                          <span key={label} className="chip">{label}</span>
                        ))}
                        {!modulesOf(user).length && <span className="cell-note">Aucun accès</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-status ${user.active ? "status-confirmed" : "status-closed"}`}>
                        {user.active ? "Actif" : "Désactivé"}
                      </span>
                      {user.mustChangePassword && <small className="cell-note">Mot de passe temporaire</small>}
                    </td>
                    <td className="nowrap">{user.lastLoginAt ? dateTimeLabel(user.lastLoginAt) : "Jamais"}</td>
                    <td className="num">{user.activeSessions}</td>
                    <td>
                      <div className="admin-actions">
                        <button title="Modifier les droits" aria-label="Modifier" onClick={() => setEditor({ record: user })}>
                          <Pencil size={16} />
                        </button>
                        {!self && (
                          <button title="Nouveau mot de passe temporaire" aria-label="Réinitialiser le mot de passe" onClick={() => reset(user)}>
                            <KeyRound size={16} />
                          </button>
                        )}
                        <button title="Fermer ses sessions" aria-label="Fermer les sessions" onClick={() => revoke(user)} disabled={!user.activeSessions}>
                          <LogOut size={16} />
                        </button>
                        {!self && (
                          <button title={user.active ? "Désactiver" : "Réactiver"} aria-label={user.active ? "Désactiver" : "Réactiver"} onClick={() => toggle(user)}>
                            <Power size={16} />
                          </button>
                        )}
                        {!self && (
                          <button className="action-delete" title="Supprimer" aria-label="Supprimer" onClick={() => remove(user)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length && <Empty title="Chargement des comptes…" />}
      </div>
      {editor && (
        <FormDialog
          wide
          title={editor.record ? `Modifier · ${editor.record.name}` : "Créer un utilisateur"}
          intro={
            editor.record
              ? "Les nouveaux droits s’appliquent dès la prochaine action de la personne, sans reconnexion."
              : "Un mot de passe temporaire sera généré : la personne devra le changer à sa première connexion."
          }
          fields={fields(editor.record)}
          initial={editor.record || {}}
          onClose={() => setEditor(null)}
          onSubmit={async (body) => {
            const record = editor.record;
            const result = await adminApi(record ? `/system/users/${record.id}` : "/system/users", {
              method: record ? "PATCH" : "POST",
              body,
            });
            setEditor(null);
            setError("");
            setSuccess(record ? "Droits enregistrés." : "Compte créé.");
            reload();
            if (result.temporaryPassword) setSecret({ user: result.item, password: result.temporaryPassword });
          }}
        />
      )}
      {secret && (
        <Dialog title="Mot de passe temporaire" onClose={() => setSecret(null)} className="admin-editor">
          <p className="editor-intro">
            Communiquez ces identifiants à <b>{secret.user.name}</b> en personne ou par téléphone. Ce mot de passe ne sera
            plus affiché ; il ne sert qu’une fois et devra être changé à la connexion.
          </p>
          <dl className="secret-box">
            <div>
              <dt>Nom d’utilisateur</dt>
              <dd>{secret.user.username}</dd>
            </div>
            <div>
              <dt>Mot de passe temporaire</dt>
              <dd>
                <code>{secret.password}</code>
                <button type="button" className="panel-action" onClick={() => navigator.clipboard?.writeText(secret.password)}>
                  <Copy size={14} /> Copier
                </button>
              </dd>
            </div>
          </dl>
          <div className="admin-editor-actions">
            <button className="button" onClick={() => setSecret(null)}>
              J’ai noté le mot de passe
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
