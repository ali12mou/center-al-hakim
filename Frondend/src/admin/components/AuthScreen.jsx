import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import { LOGO } from "../../components/logoParts.js";
import { adminApi } from "../services/adminApi.js";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import "../login.css";

const CODE_LENGTH = 6;
const highlights = [
  [BarChart3, "Tableau de bord", "Inscriptions, finances et activité en temps réel."],
  [Users, "Équipe et apprenants", "Comptes, droits d’accès et suivi pédagogique."],
  [ShieldCheck, "Double vérification", "Mot de passe + code à 6 chiffres par e-mail."],
];

function Countdown({ seconds, children }) {
  const minutes = Math.floor(seconds / 60);
  return children(`${minutes}:${String(seconds % 60).padStart(2, "0")}`);
}

export default function AuthScreen({
  error: initialError,
  notice,
  onRetry,
  onAuthenticated,
}) {
  const [step, setStep] = useState("credentials");
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [username, setUsername] = useState("");
  const blocked = Boolean(initialError);
  const detectCaps = (event) =>
    setCapsLock(Boolean(event.getModifierState?.("CapsLock")));

  async function submitCredentials(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await adminApi("/auth/login", { method: "POST", body });
      if (result.otpRequired) {
        setChallenge({
          id: result.challenge,
          email: result.email,
          console: result.delivery === "console",
          expiresAt: Date.now() + result.expiresIn * 1000,
          resendAt: Date.now() + result.resendIn * 1000,
        });
        setStep("otp");
        setBusy(false);
      } else onAuthenticated(result);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  function restart(message = "") {
    setStep("credentials");
    setChallenge(null);
    setInfo("");
    setError(message);
  }

  return (
    <main className="login-page">
      <aside className="login-showcase" aria-hidden="true">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-grid" />
        <div className="login-showcase-inner">
          <div className="login-brand">
            <span className="login-logo-badge">
              <svg viewBox="89 0 192 234">
                <image href={LOGO} width="411" height="431" />
              </svg>
            </span>
            <span>
              <strong>AL-HAKIM CENTER</strong>
              Learn Today. Lead Tomorrow.
            </span>
          </div>
          <div className="login-pitch">
            <span className="login-kicker">Espace administration</span>
            <h2>
              Pilotez votre centre de formation <em>en toute sécurité.</em>
            </h2>
            <ul>
              {highlights.map(([Icon, title, text]) => (
                <li key={title}>
                  <span>
                    <Icon size={20} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    {text}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="login-showcase-foot">
            © {new Date().getFullYear()} AL-HAKIM CENTER · Djibouti
          </p>
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-panel-top">
          <a href="/" className="login-back-site">
            <ArrowLeft size={16} />
            Retour au site
          </a>
          <ThemeToggle showLabel />
        </div>

        <div className="login-card" key={step}>
          <div className="login-card-brand">
            <svg viewBox="89 0 192 234" aria-hidden="true">
              <image href={LOGO} width="411" height="431" />
            </svg>
            <span>
              <strong>AL-HAKIM CENTER</strong>
              Espace administration
            </span>
          </div>

          <ol className="login-steps" aria-label="Étapes de connexion">
            <li className={step === "credentials" ? "active" : "done"}>
              <span>1</span>Identifiants
            </li>
            <li className={step === "otp" ? "active" : ""}>
              <span>2</span>Code e-mail
            </li>
          </ol>

          {step === "credentials" ? (
            <form onSubmit={submitCredentials}>
              <h1>Bienvenue 👋</h1>
              <p className="login-lead">
                Connectez-vous avec votre nom d’utilisateur et votre mot de passe.
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
              <label className="login-field">
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
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </span>
              </label>
              <label className="login-field">
                Mot de passe
                <span className="auth-input password-input">
                  <LockKeyhole size={18} />
                  <input
                    type={visible ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
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
              {error && (
                <p className="admin-error auth-error" role="alert">
                  <TriangleAlert size={17} />
                  {error}
                </p>
              )}
              <button className="login-submit" disabled={busy || blocked}>
                {busy ? (
                  <>
                    Vérification…
                    <LoaderCircle size={18} className="spin" />
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <OtpStep
              challenge={challenge}
              setChallenge={setChallenge}
              error={error}
              setError={setError}
              info={info}
              setInfo={setInfo}
              onBack={() => restart()}
              onExpired={(message) => restart(message)}
              onAuthenticated={onAuthenticated}
            />
          )}

          <p className="login-secure-note">
            <ShieldCheck size={15} />
            Connexion chiffrée · double vérification · accès journalisé
          </p>
        </div>
      </section>
    </main>
  );
}

function OtpStep({
  challenge,
  setChallenge,
  error,
  setError,
  info,
  setInfo,
  onBack,
  onExpired,
  onAuthenticated,
}) {
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputs = useRef([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    inputs.current[0]?.focus();
    return () => clearInterval(timer);
  }, []);

  const expiresIn = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((challenge.resendAt - now) / 1000));
  const code = digits.join("");

  async function verify(value = code) {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      onAuthenticated(
        await adminApi("/auth/otp", {
          method: "POST",
          body: { challenge: challenge.id, code: value },
        }),
      );
    } catch (failure) {
      setBusy(false);
      if (failure.otpExpired || failure.status === 429) return onExpired(failure.message);
      setError(failure.message);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    }
  }
  function fill(index, raw) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((d, i) => (i === index ? "" : d)));
      return;
    }
    const next = [...digits];
    clean
      .slice(0, CODE_LENGTH - index)
      .split("")
      .forEach((digit, offset) => (next[index + offset] = digit));
    setDigits(next);
    const target = Math.min(index + clean.length, CODE_LENGTH - 1);
    inputs.current[target]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }
  function onKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits((current) => current.map((d, i) => (i === index - 1 ? "" : d)));
      event.preventDefault();
    } else if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1)
      inputs.current[index + 1]?.focus();
  }
  async function resend() {
    setSending(true);
    setError("");
    setInfo("");
    try {
      const result = await adminApi("/auth/otp/resend", {
        method: "POST",
        body: { challenge: challenge.id },
      });
      setChallenge({
        ...challenge,
        expiresAt: Date.now() + result.expiresIn * 1000,
        resendAt: Date.now() + result.resendIn * 1000,
      });
      setDigits(Array(CODE_LENGTH).fill(""));
      setInfo(result.message);
      inputs.current[0]?.focus();
    } catch (failure) {
      if (failure.otpExpired) return onExpired(failure.message);
      if (failure.resendIn)
        setChallenge({ ...challenge, resendAt: Date.now() + failure.resendIn * 1000 });
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        verify();
      }}
    >
      <span className="login-otp-icon">
        <MailCheck size={26} />
      </span>
      <h1>Vérifiez votre e-mail</h1>
      <p className="login-lead">
        Nous avons envoyé un code à 6 chiffres à <strong>{challenge.email}</strong>.
        Saisissez-le pour accéder au tableau de bord.
      </p>
      {challenge.console && (
        <p className="auth-notice login-dev-notice" role="status">
          <Info size={17} />
          <span>
            Mode développement : l’envoi d’e-mails (SMTP) n’est pas encore configuré.
            Le code s’affiche dans le terminal de <strong>npm run dev</strong>, sur la
            ligne <code>[OTP]</code>.
          </span>
        </p>
      )}
      <div className="login-otp" role="group" aria-label="Code de vérification à 6 chiffres">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => (inputs.current[index] = element)}
            value={digit}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={index === 0 ? CODE_LENGTH : 1}
            aria-label={`Chiffre ${index + 1}`}
            className={digit ? "filled" : ""}
            disabled={busy || expiresIn === 0}
            onChange={(event) => fill(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => {
              event.preventDefault();
              fill(index, event.clipboardData.getData("text"));
            }}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
      <p className={`login-otp-timer${expiresIn < 60 ? " urgent" : ""}`}>
        {expiresIn > 0 ? (
          <Countdown seconds={expiresIn}>
            {(label) => <>Le code expire dans <strong>{label}</strong></>}
          </Countdown>
        ) : (
          "Le code a expiré. Demandez-en un nouveau."
        )}
      </p>
      {info && !error && (
        <p className="auth-notice" role="status">
          <Info size={17} />
          {info}
        </p>
      )}
      {error && (
        <p className="admin-error auth-error" role="alert">
          <TriangleAlert size={17} />
          {error}
        </p>
      )}
      <button
        className="login-submit"
        disabled={busy || code.length !== CODE_LENGTH || expiresIn === 0}
      >
        {busy ? (
          <>
            Vérification…
            <LoaderCircle size={18} className="spin" />
          </>
        ) : (
          <>
            Vérifier et continuer
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <div className="login-otp-actions">
        <button type="button" onClick={onBack}>
          <ArrowLeft size={15} />
          Changer de compte
        </button>
        <button type="button" onClick={resend} disabled={sending || resendIn > 0}>
          <RefreshCw size={15} className={sending ? "spin" : ""} />
          {resendIn > 0 ? `Renvoyer (${resendIn} s)` : "Renvoyer le code"}
        </button>
      </div>
    </form>
  );
}
