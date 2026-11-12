import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { passwordRules } from "../../../Backend/validators/password-policy.js";
import { studentApi } from "./studentApi.js";

export const StudentContext = createContext(null);
export const useStudent = () => useContext(StudentContext);

// Lecture d’une adresse de l’API student, avec rechargement à la demande.
export function useStudentData(path) {
  const [state, setState] = useState({ data: null, error: "", busy: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setState((current) => ({ ...current, busy: true }));
    studentApi(path)
      .then((data) => live && setState({ data, error: "", busy: false }))
      .catch((failure) => live && setState((current) => ({ ...current, error: failure.message, busy: false })));
    return () => {
      live = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}

// Bouton « Installer l’application » (Android / Chrome) ; consignes pour iPhone.
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(() => window.__alhakimInstall || null);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  useEffect(() => {
    const capture = (event) => {
      event.preventDefault();
      window.__alhakimInstall = event;
      setPrompt(event);
    };
    const installed = () => {
      window.__alhakimInstall = null;
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice.catch(() => null);
    window.__alhakimInstall = null;
    setPrompt(null);
  }
  return { canInstall: Boolean(prompt) && !standalone, ios: ios && !standalone, standalone, install };
}

export function PasswordInput({ value, onChange, label, autoComplete, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="st-field">
      <span>{label}</span>
      <span className="st-password">
        <input
          type={visible ? "text" : "password"}
          value={value}
          required
          maxLength={128}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
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
  );
}

export function PasswordForm({ user, onChanged, submitLabel = "Enregistrer" }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const context = { username: user.username };
  const rules = passwordRules.map((rule) => ({ ...rule, ok: rule.test(next, context) }));
  async function submit(event) {
    event.preventDefault();
    if (next !== confirm) return setError("Les deux nouveaux mots de passe ne sont pas identiques.");
    setBusy(true);
    setError("");
    try {
      onChanged(
        await studentApi("/auth/password", {
          method: "POST",
          body: { currentPassword: current, newPassword: next },
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="st-form" onSubmit={submit}>
      <PasswordInput label="Mot de passe actuel" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput label="Nouveau mot de passe" value={next} onChange={setNext} autoComplete="new-password" />
      <ul className="st-rules">
        {rules.map((rule) => (
          <li key={rule.id} className={rule.ok ? "ok" : ""}>
            {rule.label}
          </li>
        ))}
      </ul>
      <PasswordInput label="Confirmer le nouveau mot de passe" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && (
        <p role="alert" className="st-error">
          {error}
        </p>
      )}
      <button className="st-button" disabled={busy || rules.some((rule) => !rule.ok)}>
        <KeyRound size={18} /> {busy ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
