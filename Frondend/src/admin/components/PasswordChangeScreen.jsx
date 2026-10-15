import { KeyRound } from "lucide-react";
import PasswordForm from "./PasswordForm.jsx";

// Affiché tant que le compte utilise un mot de passe temporaire (le Backend bloque le reste).
export default function PasswordChangeScreen({ user, onChanged, onLogout }) {
  return (
    <main className="admin-auth admin-auth-single">
      <div className="auth-card">
        <span className="auth-emblem">
          <KeyRound size={28} />
        </span>
        <h1>Choisissez votre mot de passe.</h1>
        <p>
          Vous êtes connecté avec un mot de passe temporaire. Remplacez-le par un
          mot de passe personnel pour ouvrir l’administration.
        </p>
        <PasswordForm
          user={user}
          onChanged={onChanged}
          submitLabel="Enregistrer et continuer"
        />
        <button type="button" className="auth-back" onClick={onLogout}>
          Se déconnecter
        </button>
      </div>
    </main>
  );
}
