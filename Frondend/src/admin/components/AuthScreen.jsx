import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { LOGO } from "../../components/logoParts.js";
import { adminApi } from "../services/adminApi.js";

export default function AuthScreen({
  state,
  error: initialError,
  notice,
  onRetry,
  onAuthenticated,
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const setup = state?.setupRequired && state?.setupAllowed;
  const blocked = Boolean(initialError) || (state?.setupRequired && !state?.setupAllowed);
  const detectCaps = (event) =>
    setCapsLock(Boolean(event.getModifierState?.("CapsLock")));
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
      setBusy(false);
    }
  }
  return (
    <main className="admin-auth admin-auth-single">
      <div className="auth-shell">
        <form onSubmit={submit} className="auth-card">
          <div className="auth-card-brand">
            <svg className="auth-logo" viewBox="89 0 192 234" aria-hidden="true">
              <image href={LOGO} width="411" height="431" />
            </svg>
            <span>
              <strong>AL-HAKIM CENTER</strong>
              Espace administration
            </span>
          </div>
          <h1>{setup ? "Créer le compte administrateur" : "Connexion"}</h1>
          <p>
            {setup
              ? "Créez le premier compte administrateur. Choisissez vos propres identifiants."
              : "Identifiez-vous pour accéder au tableau de bord."}
          </p>
          {notice && !error && (
            <p className="auth-notice" role="status">
              <Info size={17} />
              {notice}
            </p>
          )}
          {initialError && (
            <div className="auth-retry">
              <p className="admin-error" role="alert">
                {initialError}
              </p>
              <button type="button" className="button button-outline" onClick={onRetry}>
                <RefreshCw size={16} />
                Réessayer
              </button>
            </div>
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
                <span className="auth-input">
                  <UserRound size={18} />
                  <input
                    name="name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </span>
              </label>
              <label>
                Adresse e-mail
                <span className="auth-input">
                  <Mail size={18} />
                  <input name="email" type="email" autoComplete="email" required />
                </span>
              </label>
            </>
          )}
          <label>
            Nom d’utilisateur
            <span className="auth-input">
              <UserRound size={18} />
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
                autoFocus
              />
            </span>
          </label>
          <label>
            Mot de passe
            <span className="auth-input password-input">
              <LockKeyhole size={18} />
              <input
                type={visible ? "text" : "password"}
                name="password"
                autoComplete={setup ? "new-password" : "current-password"}
                placeholder={setup ? "Au moins 12 caractères" : "Votre mot de passe"}
                minLength={setup ? 12 : 1}
                maxLength={128}
                required
                onKeyDown={detectCaps}
                onKeyUp={detectCaps}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {capsLock && (
            <small className="auth-caps" role="status">
              <TriangleAlert size={15} />
              Verrouillage des majuscules activé.
            </small>
          )}
          {setup && (
            <small className="auth-hint">
              12 caractères minimum, avec au moins trois types parmi minuscules,
              majuscules, chiffres et symboles.
            </small>
          )}
          {error && (
            <p className="admin-error auth-error" role="alert">
              <TriangleAlert size={17} />
              {error}
            </p>
          )}
          <button className="button auth-submit" disabled={busy || blocked}>
            {busy ? (
              <>
                Vérification…
                <LoaderCircle size={18} className="spin" />
              </>
            ) : (
              <>
                {setup ? "Créer mon compte administrateur" : "Se connecter"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="auth-secure-note">
            <ShieldCheck size={15} />
            Accès protégé et journalisé
          </p>
        </form>
        <div className="auth-footer">
          <a href="/">
            <ArrowLeft size={15} />
            Retour au site
          </a>
          <span>© {new Date().getFullYear()} AL-HAKIM CENTER</span>
        </div>
      </div>
    </main>
  );
}
