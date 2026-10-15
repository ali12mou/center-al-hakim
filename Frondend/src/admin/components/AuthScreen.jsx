import { useState } from "react";
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  History,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import Brand from "../../components/Brand.jsx";
import { LOGO } from "../../components/logoParts.js";
import { adminApi } from "../services/adminApi.js";

const guarantees = [
  [LockKeyhole, "Verrouillage automatique après 5 tentatives incorrectes"],
  [Clock, "Session fermée après 30 min d’inactivité"],
  [History, "Chaque connexion inscrite au journal de sécurité"],
];

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
    <main className="admin-auth">
      <div className="admin-auth-story">
        <a href="/" className="auth-story-brand">
          <Brand light />
        </a>
        <div className="auth-story-body">
          <span className="eyebrow">ESPACE ADMINISTRATION</span>
          <h1>
            Un centre organisé.
            <br />
            <em>Des ambitions qui avancent.</em>
          </h1>
          <p>
            Programmes, publications, inscriptions et évaluations : tout le
            pilotage de AL-HAKIM CENTER au même endroit.
          </p>
          <ul className="auth-guarantees">
            {guarantees.map(([Icon, label]) => (
              <li key={label}>
                <span>
                  <Icon size={17} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <small>© {new Date().getFullYear()} AL-HAKIM CENTER · Djibouti</small>
      </div>
      <div className="admin-auth-form">
        <form onSubmit={submit} className="auth-card">
          <svg className="auth-logo" viewBox="89 0 192 234" aria-hidden="true">
            <image href={LOGO} width="411" height="431" />
          </svg>
          <h2>
            {setup ? "Bienvenue dans votre administration." : "Connexion administrateur"}
          </h2>
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
          <a href="/" className="auth-back">
            Retour au site public
          </a>
        </form>
      </div>
    </main>
  );
}
