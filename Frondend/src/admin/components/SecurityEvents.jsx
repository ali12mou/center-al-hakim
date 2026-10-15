import {
  CircleCheck,
  KeyRound,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { dateTimeLabel } from "../config/sections.js";

// Chaque état porte une icône et un libellé : la couleur n’est jamais seule.
const events = {
  setup: [ShieldCheck, "Administration créée", "good"],
  login_success: [LogIn, "Connexion réussie", "good"],
  login_failure: [TriangleAlert, "Échec de connexion", "warning"],
  login_locked: [ShieldAlert, "Connexion bloquée (trop de tentatives)", "critical"],
  logout: [LogOut, "Déconnexion", "neutral"],
  password_changed: [KeyRound, "Mot de passe modifié", "good"],
  password_change_failed: [TriangleAlert, "Changement de mot de passe refusé", "warning"],
  password_reset: [KeyRound, "Mot de passe réinitialisé (serveur)", "warning"],
  sessions_revoked: [CircleCheck, "Autres sessions fermées", "neutral"],
};

export default function SecurityEvents({ items, limit }) {
  if (!items) return <p className="dashboard-zero">Chargement du journal…</p>;
  if (!items.length)
    return <p className="dashboard-zero">Aucun événement enregistré.</p>;
  return (
    <ul className="security-events">
      {items.slice(0, limit).map((item) => {
        const [Icon, label, tone] = events[item.event] || [
          ShieldCheck,
          item.event,
          "neutral",
        ];
        return (
          <li key={item.id} className={`tone-${tone}`}>
            <span className="security-event-icon">
              <Icon size={16} />
            </span>
            <span>
              <strong>{label}</strong>
              <small>
                {[item.username && `@${item.username}`, item.device, item.ip]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <time dateTime={item.createdAt}>{dateTimeLabel(item.createdAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
