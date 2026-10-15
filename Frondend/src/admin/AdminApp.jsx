import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogOut, ArrowUpRight, Menu, X, ShieldCheck } from "lucide-react";
import Brand from "../components/Brand.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import AssessmentsAdminPage from "./pages/AssessmentsAdminPage.jsx";
import { adminApi, setAdminCsrf } from "./services/adminApi.js";
import { menu, sections } from "./config/sections.js";
import "./admin.css";

export default function AdminApp() {
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    adminApi("/auth/status")
      .then((value) => {
        setAuth(value);
        setAdminCsrf(value.csrfToken);
      })
      .catch((failure) => setError(failure.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  async function logout() {
    try {
      await adminApi("/auth/logout", { method: "POST" });
      setAdminCsrf("");
      setAuth({ user: null });
      navigate("/admin/login", { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }
  if (!ready)
    return (
      <div className="loading-screen">
        <ShieldCheck size={34} />
        <p>Ouverture de l’administration…</p>
      </div>
    );
  if (!auth?.user && location.pathname !== "/admin/login")
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (!auth?.user)
    return (
      <AuthScreen
        state={auth}
        error={error}
        onAuthenticated={(value) => {
          setAuth(value);
          setAdminCsrf(value.csrfToken);
          setError("");
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
  if (location.pathname === "/admin/login")
    return <Navigate to="/admin" replace />;
  const current =
    menu.find((item) => item.path === location.pathname) || menu[0];
  return (
    <div className="admin-layout">
      <aside className={open ? "admin-sidebar sidebar-open" : "admin-sidebar"}>
        <Link to="/admin" className="admin-brand">
          <Brand light />
        </Link>
        <span className="sidebar-caption">ESPACE ADMINISTRATEUR</span>
        <nav aria-label="Administration">
          {menu.map(({ path, icon: Icon, label }) => (
            <NavLink end={path === "/admin"} key={path} to={path}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/">
            Voir le site public <ArrowUpRight size={16} />
          </Link>
          <span>
            <i />
            Base du centre connectée
          </span>
        </div>
      </aside>
      {open && (
        <button
          className="admin-sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu administrateur"
        />
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <button
              className="admin-mobile-menu"
              aria-label={
                open
                  ? "Fermer le menu administrateur"
                  : "Ouvrir le menu administrateur"
              }
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <span>
              Administration <b>/ {current.label}</b>
            </span>
          </div>
          <div className="admin-account">
            <span className="admin-avatar">{auth.user.name[0]}</span>
            <span>
              <strong>{auth.user.name}</strong>
              <small>Administrateur</small>
            </span>
            <button
              onClick={logout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut size={18} />
            </button>
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
                  Section introuvable.{" "}
                  <Link to="/admin">Retour au tableau de bord</Link>
                </p>
              }
            />
          </Routes>
        </main>
        <footer className="admin-footer">
          AL-HAKIM CENTER · Administration{" "}
          <span>Formation, langues & technologie</span>
        </footer>
      </div>
    </div>
  );
}
