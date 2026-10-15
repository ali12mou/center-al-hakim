import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, X } from "lucide-react";
import { adminApi } from "../services/adminApi.js";
import {
  passwordRules,
  passwordScore,
} from "../../../../Backend/validators/password-policy.js";

const levels = ["Très faible", "Faible", "Moyen", "Correct", "Solide", "Excellent"];

function PasswordField({ label, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-input">
        <input type={visible ? "text" : "password"} maxLength={128} required {...props} />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

// Les règles affichées sont celles que le Backend applique.
export default function PasswordForm({
  user,
  onChanged,
  submitLabel = "Mettre à jour le mot de passe",
}) {
  const empty = { currentPassword: "", newPassword: "", confirm: "" };
  const [values, setValues] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const context = { username: user.username };
  const score = passwordScore(values.newPassword, context);
  const strong = passwordRules.every((rule) =>
    rule.test(values.newPassword, context),
  );
  const matches = values.confirm.length > 0 && values.confirm === values.newPassword;
  const update = (event) =>
    setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    if (!strong || !matches) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi("/auth/password", {
        method: "POST",
        body: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      });
      setValues(empty);
      setSuccess("Mot de passe mis à jour. Vos autres sessions ont été fermées.");
      onChanged(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="password-form" onSubmit={submit}>
      {/* Aide les gestionnaires de mots de passe à associer le bon compte. */}
      <input
        className="sr-only"
        name="username"
        autoComplete="username"
        value={user.username}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <PasswordField
        label="Mot de passe actuel"
        name="currentPassword"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={update}
      />
      <PasswordField
        label="Nouveau mot de passe"
        name="newPassword"
        autoComplete="new-password"
        value={values.newPassword}
        onChange={update}
      />
      <div className="password-meter" data-score={score}>
        <div aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <i key={index} className={index < score ? "on" : ""} />
          ))}
        </div>
        <span aria-live="polite">
          {values.newPassword ? levels[score] : "Robustesse du mot de passe"}
        </span>
      </div>
      <ul className="password-rules">
        {passwordRules.map((rule) => {
          const ok = rule.test(values.newPassword, context);
          return (
            <li key={rule.id} className={ok ? "ok" : ""}>
              {ok ? <Check size={14} /> : <X size={14} />}
              {rule.label}
            </li>
          );
        })}
      </ul>
      <PasswordField
        label="Confirmer le nouveau mot de passe"
        name="confirm"
        autoComplete="new-password"
        value={values.confirm}
        onChange={update}
      />
      {values.confirm && !matches && (
        <small className="password-mismatch">
          Les deux mots de passe ne correspondent pas.
        </small>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}
      <button
        className="button"
        disabled={busy || !strong || !matches || !values.currentPassword}
      >
        {busy ? "Mise à jour…" : submitLabel}
        <KeyRound size={17} />
      </button>
    </form>
  );
}
