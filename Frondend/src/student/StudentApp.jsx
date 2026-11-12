import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChartNoAxesColumn, House, LogIn, UserRound, Wallet } from "lucide-react";
import { LOGO } from "../components/logoParts.js";
import { onStudentAuthEvent, setStudentCsrf, studentApi } from "./studentApi.js";
import { PasswordForm, PasswordInput, StudentContext, useInstallPrompt } from "./shared.jsx";
import { AnnouncementsPage, CoursesPage, HomePage, PaymentsPage, ProfilePage, ProgressPage } from "./pages.jsx";
import "./student.css";

// Application des students (PWA), servie sous /etudiant. Elle ne parle qu’à
// /api/student : aucune page ni donnée de l’administration n’y est accessible.
const SPLASH_MS = 1200;

function Splash() {
  return (
    <div className="st-splash" role="status" aria-label="Ouverture de l’espace student">
      <img src={LOGO} alt="AL-HAKIM CENTER" width="411" height="431" />
      <span className="st-splash-bar">
        <span />
      </span>
      <span className="st-splash-label">Espace student</span>
    </div>
  );
}

function InstallHint() {
  const { canInstall, ios, install } = useInstallPrompt();
  if (canInstall)
    return (
      <button type="button" className="st-button st-button-ghost" onClick={install}>
        Installer l’application sur ce téléphone
      </button>
    );
  if (ios)
    return (
      <p className="st-hint">
        Sur iPhone : touchez <b>Partager</b> puis <b>« Sur l’écran d’accueil »</b> pour installer l’application.
      </p>
    );
  return null;
}

function LoginScreen({ notice, onSignedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await studentApi("/auth/login", { method: "POST", body: { username, password } }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="st-auth">
      <img className="st-auth-logo" src={LOGO} alt="AL-HAKIM CENTER" width="411" height="431" />
      <h1>Espace student</h1>
      <p className="st-muted">Connectez-vous avec l’identifiant et le mot de passe remis par le centre.</p>
      <form className="st-card st-form" onSubmit={submit}>
        {notice && <p className="st-notice">{notice}</p>}
        <label className="st-field">
          <span>Identifiant</span>
          <input
            value={username}
            required
            maxLength={50}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <PasswordInput label="Mot de passe" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p role="alert" className="st-error">
            {error}
          </p>
        )}
        <button className="st-button" disabled={busy}>
          <LogIn size={18} /> {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <InstallHint />
      <p className="st-hint">Identifiant oublié ou mot de passe perdu ? Demandez un nouvel accès à l’accueil du centre.</p>
    </main>
  );
}

function FirstPasswordScreen({ user, onChanged, onLogout }) {
  return (
    <main className="st-auth">
      <img className="st-auth-logo small" src={LOGO} alt="AL-HAKIM CENTER" width="411" height="431" />
      <h1>Bienvenue, {user.name.split(" ")[0]} !</h1>
      <p className="st-muted">
        Pour protéger votre espace, remplacez le mot de passe provisoire remis par le centre par un mot de passe
        personnel.
      </p>
      <div className="st-card">
        <PasswordForm user={user} onChanged={onChanged} submitLabel="Enregistrer et continuer" />
      </div>
      <button type="button" className="st-link" onClick={onLogout}>
        Se déconnecter
      </button>
    </main>
  );
}

const TABS = [
  ["/etudiant", "Accueil", House],
  ["/etudiant/cours", "Cours", BookOpen],
  ["/etudiant/suivi", "Suivi", ChartNoAxesColumn],
  ["/etudiant/paiements", "Paiements", Wallet],
  ["/etudiant/profil", "Profil", UserRound],
];

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="st-app">
      <header className="st-topbar">
        <img src="/icons/icon-192.png" alt="" width="36" height="36" />
        <span>
          <strong>AL-HAKIM CENTER</strong>
          <small>Espace student</small>
        </span>
      </header>
      <main className="st-content">
        <Routes>
          <Route index element={<HomePage />} />
          <Route path="cours" element={<CoursesPage />} />
          <Route path="suivi" element={<ProgressPage />} />
          <Route path="paiements" element={<PaymentsPage />} />
          <Route path="annonces" element={<AnnouncementsPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/etudiant" replace />} />
        </Routes>
      </main>
      <nav className="st-tabbar" aria-label="Navigation de l’espace student">
        {TABS.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/etudiant"}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function StudentApp() {
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [splash, setSplash] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.add("student-mode");
    document.getElementById("boot-splash")?.remove();
    const timer = setTimeout(() => setSplash(false), SPLASH_MS);
    return () => {
      clearTimeout(timer);
      document.documentElement.classList.remove("student-mode");
    };
  }, []);
  useEffect(() => {
    let live = true;
    studentApi("/auth/status")
      .then((value) => {
        if (!live) return;
        setError("");
        setAuth(value);
        setStudentCsrf(value.csrfToken);
      })
      .catch((failure) => live && setError(failure.message));
    return () => {
      live = false;
    };
  }, [attempt]);
  useEffect(
    () =>
      onStudentAuthEvent((event) => {
        if (event.type === "expired") {
          setStudentCsrf("");
          setAuth((current) => ({ ...current, user: null }));
          setNotice(event.message);
        }
        if (event.type === "password")
          setAuth((current) =>
            current?.user ? { ...current, user: { ...current.user, mustChangePassword: true } } : current,
          );
      }),
    [],
  );
  function applySession(value) {
    setStudentCsrf(value.csrfToken);
    setAuth(value);
    setNotice("");
  }
  async function logout() {
    try {
      await studentApi("/auth/logout", { method: "POST" });
    } catch {}
    setStudentCsrf("");
    setAuth({ user: null });
    setNotice("Vous êtes déconnecté.");
    navigate("/etudiant", { replace: true });
  }

  if (error && !auth)
    return (
      <main className="st-auth">
        <img className="st-auth-logo small" src={LOGO} alt="AL-HAKIM CENTER" width="411" height="431" />
        <p role="alert" className="st-error">
          {error}
        </p>
        <button className="st-button" onClick={() => setAttempt((value) => value + 1)}>
          Réessayer
        </button>
      </main>
    );
  if (splash || !auth) return <Splash />;
  if (!auth.user) return <LoginScreen notice={notice} onSignedIn={applySession} />;
  if (auth.user.mustChangePassword)
    return <FirstPasswordScreen user={auth.user} onChanged={applySession} onLogout={logout} />;
  return (
    <StudentContext.Provider value={{ user: auth.user, logout, applySession }}>
      <Shell />
    </StudentContext.Provider>
  );
}
