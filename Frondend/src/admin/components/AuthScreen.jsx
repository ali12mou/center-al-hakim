import { useState } from "react";
import { ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import Brand from "../../components/Brand.jsx";
import { adminApi } from "../services/adminApi.js";

export default function AuthScreen({
  state,
  error: initialError,
  onAuthenticated,
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const setup = state?.setupRequired && state?.setupAllowed;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      onAuthenticated(
        await adminApi(setup ? "/auth/setup" : "/auth/login", {
          method: "POST",
          body,
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-auth">
      <div className="admin-auth-story">
        <a href="/">
          <Brand light />
        </a>
        <div>
          <span className="eyebrow">AL-HAKIM CENTER · ADMINISTRATION</span>
          <h1>
            Un centre organisé.
            <br />
            Des ambitions qui avancent.
          </h1>
          <p>
            Vos programmes, vos publications et vos apprenants, réunis dans un
            même espace.
          </p>
          <div className="auth-security">
            <ShieldCheck size={21} />
            <span>Un accès protégé pour l’équipe du centre.</span>
          </div>
        </div>
        <small>Formation · Langues · Technologie</small>
      </div>
      <div className="admin-auth-form">
        <form onSubmit={submit}>
          <span className="auth-emblem">
            <ShieldCheck size={31} />
          </span>
          <h2>
            {setup
              ? "Bienvenue dans votre administration."
              : "Connexion administrateur."}
          </h2>
          <p>
            {setup
              ? "Créez le premier compte administrateur. Choisissez vos propres identifiants."
              : "Saisissez vos identifiants pour accéder à votre tableau de bord AL-HAKIM CENTER."}
          </p>
          {initialError && (
            <p className="admin-error" role="alert">
              {initialError}
            </p>
          )}
          {state?.setupRequired && !state?.setupAllowed && (
            <p className="admin-error">
              La création du premier compte doit être effectuée localement ou
              avec le script sécurisé du backend.
            </p>
          )}
          {setup && (
            <>
              <label>
                Nom complet
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Adresse e-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            </>
          )}
          <label>
            Nom d’utilisateur
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Votre nom d’utilisateur"
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_.\-]+"
              required
            />
          </label>
          <label>
            Mot de passe
            <span className="password-input">
              <input
                type={visible ? "text" : "password"}
                name="password"
                autoComplete={setup ? "new-password" : "current-password"}
                placeholder={setup ? "Au moins 12 caractères" : "Votre mot de passe"}
                minLength={setup ? 12 : 1}
                maxLength={128}
                required
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={
                  visible
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {setup && (
            <small>
              Utilisez un mot de passe unique d’au moins 12 caractères.
            </small>
          )}
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button"
            disabled={
              busy ||
              !!initialError ||
              (state?.setupRequired && !state?.setupAllowed)
            }
          >
            {busy
              ? "Connexion en cours…"
              : setup
                ? "Créer mon compte administrateur"
                : "Se connecter"}
            <ArrowRight size={18} />
          </button>
          <a href="/" className="auth-back">
            Retour au site public
          </a>
        </form>
      </div>
    </main>
  );
}
