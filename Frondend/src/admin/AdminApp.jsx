import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ExternalLink, Menu, ShieldCheck, X } from "lucide-react";
import LogoLoader from "../components/LogoLoader.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import AdminSidebar from "./components/AdminSidebar.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import PasswordChangeScreen from "./components/PasswordChangeScreen.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import AssessmentsAdminPage from "./pages/AssessmentsAdminPage.jsx";
import SecurityPage from "./pages/SecurityPage.jsx";
import { adminApi, onAdminAuthEvent, setAdminCsrf } from "./services/adminApi.js";
import { menu, sections } from "./config/sections.js";
import "./admin.css";

const COLLAPSE_KEY = "alhakim-admin-sidebar";

export default function AdminApp() {
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const signedIn = Boolean(auth?.user && !auth.user.mustChangePassword);

  function applySession(value) {
    setAuth((current) => ({ ...current, ...value }));
    setAdminCsrf(value.csrfToken);
  }
  function signOut(message) {
    setAdminCsrf("");
    setAuth((current) => ({ ...current, user: null }));
    setNotice(message);
  }
  useEffect(() => {
    let live = true;
    adminApi("/auth/status")
      .then((value) => {
        if (!live) return;
        setError("");
        setAuth(value);
        setAdminCsrf(value.csrfToken);
      })
      .catch((failure) => live && setError(failure.message))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [attempt]);
  function retry() {
    setReady(false);
    setError("");
    setAttempt((value) => value + 1);
  }
  useEffect(
    () =>
      onAdminAuthEvent((event) => {
        if (event.type === "expired") signOut(event.message);
        if (event.type === "password")
          setAuth((current) =>
            current?.user
              ? { ...current, user: { ...current.user, mustChangePassword: true } }
              : current,
          );
      }),
    [],
  );
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!signedIn) return;
    adminApi("/badges")
      .then(setBadges)
      .catch(() => {});
  }, [signedIn, location.pathname]);
  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {}
      return !value;
    });
  }
  async function logout() {
    try {
      await adminApi("/auth/logout", { method: "POST" });
    } catch (failure) {
      // Une session déjà expirée est de toute façon fermée côté serveur.
      if (failure.status !== 401) return setError(failure.message);
    }
    signOut("Vous êtes déconnecté.");
    navigate("/admin/login", { replace: true });
  }

  if (!ready)
    return (
      <div className="admin-boot">
        <LogoLoader label="Ouverture de l’administration…" />
      </div>
    );
  if (!auth?.user && location.pathname !== "/admin/login")
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!auth?.user)
    return (
      <AuthScreen
        state={auth}
        error={error}
        notice={notice}
        onRetry={retry}
        onAuthenticated={(value) => {
          applySession(value);
          setError("");
          setNotice("");
          const destination = location.state?.from;
          navigate(
            destination?.startsWith("/admin/") && destination !== "/admin/login"
              ? destination
              : "/admin",
            { replace: true },
          );
        }}
      />
    );
  if (auth.user.mustChangePassword)
    return (
      <PasswordChangeScreen
        user={auth.user}
        onChanged={(value) => {
          applySession(value);
          navigate("/admin", { replace: true });
        }}
        onLogout={logout}
      />
    );
  if (location.pathname === "/admin/login") return <Navigate to="/admin" replace />;
  const current = menu.find((item) => item.path === location.pathname) || menu[0];
  return (
    <div className={collapsed ? "admin-layout sidebar-collapsed" : "admin-layout"}>
      <AdminSidebar
        open={open}
        collapsed={collapsed}
        badges={badges}
        user={auth.user}
        onToggle={toggleCollapsed}
        onLogout={logout}
      />
      {open && (
        <button
          className="admin-sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu administrateur"
        />
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <button
              className="admin-mobile-menu"
              aria-label={open ? "Fermer le menu administrateur" : "Ouvrir le menu administrateur"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span className="admin-breadcrumb">
              <span>{current.group}</span>
              <ChevronRight size={14} />
              <b>{current.label}</b>
            </span>
          </div>
          <div className="admin-topbar-actions">
            <span
              className="admin-session-pill"
              title={`Déconnexion automatique après ${auth.idleMinutes || 30} min d’inactivité`}
            >
              <ShieldCheck size={15} />
              Session sécurisée
            </span>
            <Link to="/" className="admin-icon-link" title="Voir le site public" aria-label="Voir le site public">
              <ExternalLink size={18} />
            </Link>
            <AccountMenu user={auth.user} onLogout={logout} />
          </div>
        </header>
        <main className="admin-content">
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <Routes>
            <Route index element={<DashboardPage user={auth.user} />} />
            <Route
              path="security"
              element={<SecurityPage user={auth.user} onSessionRenewed={applySession} />}
            />
            {Object.keys(sections).map((resource) => (
              <Route
                key={resource}
                path={resource}
                element={
                  resource === "assessments" ? (
                    <AssessmentsAdminPage />
                  ) : (
                    <ResourcePage key={resource} resource={resource} />
                  )
                }
              />
            ))}
            <Route
              path="*"
              element={
                <p>
                  Section introuvable. <Link to="/admin">Retour au tableau de bord</Link>
                </p>
              }
            />
          </Routes>
        </main>
        <footer className="admin-footer">
          AL-HAKIM CENTER · Administration <span>Formation, langues & technologie</span>
        </footer>
      </div>
    </div>
  );
}
