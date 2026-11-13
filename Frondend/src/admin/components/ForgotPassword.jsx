import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  TriangleAlert,
  X,
} from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import {
  passwordRules,
  passwordScore,
} from "../../../../Backend/validators/password-policy.js";

const levels = ["Très faible", "Faible", "Moyen", "Correct", "Solide", "Excellent"];

function ErrorLine({ error }) {
  return error ? (
    <p className="admin-error auth-error" role="alert">
      <TriangleAlert size={17} />
      {error}
    </p>
  ) : null;
}

// Étape 1 : adresse e-mail du compte administrateur.
export function ForgotEmailStep({ initialError, onSent, onBack }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await adminApi("/auth/forgot", { method: "POST", body: { email } });
      onSent(result);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <span className="login-otp-icon">
        <KeyRound size={26} />
      </span>
      <h1>Mot de passe oublié ?</h1>
      <p className="login-lead">
        Saisissez l’adresse e-mail de votre compte administrateur. Nous vous enverrons un
        code à 6 chiffres pour choisir un nouveau mot de passe.
      </p>
      <label className="login-field">
        Adresse e-mail
        <span className="auth-input">
          <Mail size={18} />
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            maxLength={254}
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </span>
      </label>
      <ErrorLine error={error} />
      <button className="login-submit" disabled={busy || !email}>
        {busy ? (
          <>
            Envoi du code…
            <LoaderCircle size={18} className="spin" />
          </>
        ) : (
          <>
            Recevoir le code
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <div className="login-otp-actions">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={15} />
          Retour à la connexion
        </button>
      </div>
    </form>
  );
}

function PasswordInput({ label, visible, onToggle, ...props }) {
  return (
    <label className="login-field">
      {label}
      <span className="auth-input password-input">
        <LockKeyhole size={18} />
        <input type={visible ? "text" : "password"} maxLength={128} required {...props} />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

// Étape 3 : nouveau mot de passe (après le code vérifié).
export function NewPasswordStep({ challenge, account, onDone, onExpired, onBack }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = { username: account.username };
  const score = passwordScore(password, context);
  const strong = passwordRules.every((rule) => rule.test(password, context));
  const matches = confirm.length > 0 && confirm === password;

  async function submit(event) {
    event.preventDefault();
    if (!strong || !matches) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminApi("/auth/forgot/reset", {
        method: "POST",
        body: { challenge, newPassword: password },
      });
      onDone(result);
    } catch (failure) {
      setBusy(false);
      if (failure.otpExpired) return onExpired(failure.message);
      setError(failure.message);
    }
  }

  return (
    <form onSubmit={submit}>
      <span className="login-otp-icon">
        <LockKeyhole size={26} />
      </span>
      <h1>Nouveau mot de passe</h1>
      <p className="login-lead">
        Code vérifié ✔ Choisissez un nouveau mot de passe pour le compte{" "}
        <strong>{account.username}</strong>.
      </p>
      {/* Aide les gestionnaires de mots de passe à associer le bon compte. */}
      <input
        className="sr-only"
        name="username"
        autoComplete="username"
        value={account.username}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <PasswordInput
        label="Nouveau mot de passe"
        name="newPassword"
        autoComplete="new-password"
        placeholder="Votre nouveau mot de passe"
        autoFocus
        value={password}
        visible={visible}
        onToggle={() => setVisible(!visible)}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="password-meter login-meter" data-score={score}>
        <div aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <i key={index} className={index < score ? "on" : ""} />
          ))}
        </div>
        <span aria-live="polite">
          {password ? levels[score] : "Robustesse du mot de passe"}
        </span>
      </div>
      <ul className="password-rules login-rules">
        {passwordRules.map((rule) => {
          const ok = rule.test(password, context);
          return (
            <li key={rule.id} className={ok ? "ok" : ""}>
              {ok ? <Check size={14} /> : <X size={14} />}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <PasswordInput
        label="Confirmer le mot de passe"
        name="confirm"
        autoComplete="new-password"
        placeholder="Saisissez-le une seconde fois"
        value={confirm}
        visible={visible}
        onToggle={() => setVisible(!visible)}
        onChange={(event) => setConfirm(event.target.value)}
      />
      {confirm && !matches && (
        <small className="password-mismatch">
          Les deux mots de passe ne correspondent pas.
        </small>
      )}
      <ErrorLine error={error} />
      <button className="login-submit" disabled={busy || !strong || !matches}>
        {busy ? (
          <>
            Enregistrement…
            <LoaderCircle size={18} className="spin" />
          </>
        ) : (
          <>
            Enregistrer le mot de passe
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <div className="login-otp-actions">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={15} />
          Annuler
        </button>
      </div>
    </form>
  );
}
