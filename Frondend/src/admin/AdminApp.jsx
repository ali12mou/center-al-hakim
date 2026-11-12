import { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ExternalLink, Menu, ShieldCheck, X } from "lucide-react";
import LogoLoader from "../components/LogoLoader.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import AdminSidebar from "./components/AdminSidebar.jsx";
import AccountMenu from "./components/AccountMenu.jsx";
import PasswordChangeScreen from "./components/PasswordChangeScreen.jsx";
import { Forbidden } from "./components/ui.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import AssessmentsAdminPage from "./pages/AssessmentsAdminPage.jsx";
import SecurityPage from "./pages/SecurityPage.jsx";
import OverviewPage from "./pages/system/OverviewPage.jsx";
import UsersPage from "./pages/system/UsersPage.jsx";
import GlobalSecurityPage from "./pages/system/GlobalSecurityPage.jsx";
import GlobalReportsPage from "./pages/system/GlobalReportsPage.jsx";
import HrDashboard from "./pages/rh/HrDashboard.jsx";
import StaffPage from "./pages/rh/StaffPage.jsx";
import ContractsPage from "./pages/rh/ContractsPage.jsx";
import PlanningPage from "./pages/rh/PlanningPage.jsx";
import AttendancePage from "./pages/rh/AttendancePage.jsx";
import LeavesPage from "./pages/rh/LeavesPage.jsx";
import RatesPage from "./pages/rh/RatesPage.jsx";
import PayrollPage from "./pages/rh/PayrollPage.jsx";
import AdjustmentsPage from "./pages/rh/AdjustmentsPage.jsx";
import HrReportsPage from "./pages/rh/HrReportsPage.jsx";
import HrSettingsPage from "./pages/rh/HrSettingsPage.jsx";
import FinanceDashboard from "./pages/finance/FinanceDashboard.jsx";
import { DiscountsPage } from "./pages/finance/CataloguePages.jsx";
import { CollectionsPage, FeesPage, StudentsPage } from "./pages/finance/StudentFinancePages.jsx";
import RecordPaymentPage from "./pages/finance/RecordPaymentPage.jsx";
import StudentAccountsPage from "./pages/finance/StudentAccountsPage.jsx";
import ReceivablesPage from "./pages/finance/ReceivablesPage.jsx";
import PaymentsPage from "./pages/finance/PaymentsPage.jsx";
import InvoicesPage from "./pages/finance/InvoicesPage.jsx";
import StaffPaymentsPage from "./pages/finance/StaffPaymentsPage.jsx";
import AdvancesPage from "./pages/finance/AdvancesPage.jsx";
import ExpensesPage, { CategoriesPage } from "./pages/finance/ExpensesPage.jsx";
import AccountsPage, { TransfersPage } from "./pages/finance/AccountsPage.jsx";
import FinanceReportsPage from "./pages/finance/FinanceReportsPage.jsx";
import FinanceSettingsPage from "./pages/finance/FinanceSettingsPage.jsx";
import StudentAccessPage from "./pages/eleves/AccessPage.jsx";
import LessonsPage from "./pages/eleves/LessonsPage.jsx";
import StudentAttendancePage from "./pages/eleves/AttendancePage.jsx";
import GradesPage from "./pages/eleves/GradesPage.jsx";
import StudentAnnouncementsPage from "./pages/eleves/AnnouncementsPage.jsx";
import { AdminProvider, useAdmin } from "./context/AdminContext.jsx";
import { adminApi, onAdminAuthEvent, setAdminCsrf } from "./services/adminApi.js";
import { sections } from "./config/sections.js";
import { findEntry, firstPath, moduleOf, visibleModules } from "./config/modules.js";
import "./admin.css";
import "./admin-modules.css";
import ThemeToggle from "../components/ThemeToggle.jsx";

const COLLAPSE_KEY = "alhakim-admin-sidebar";

// Page affichée seulement si le compte a le droit demandé (le Backend le vérifie aussi).
function Guard({ section, action = "view", superAdmin, children }) {
  const admin = useAdmin();
  const allowed = superAdmin ? admin.superAdmin : admin.can(section, action);
  return allowed ? children : <Forbidden />;
}
const ACCOUNT_PAGES = ["cash", "bank", "dmoney", "waafi", "cacpay", "sabapay"];

function AdminShell({ auth, badges, collapsed, onToggle, onLogout, onSessionRenewed, error }) {
  const admin = useAdmin();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const modules = visibleModules(admin);
  const lastModule = useRef(null);
  const detected = moduleOf(location.pathname);
  if (detected) lastModule.current = detected;
  const current = lastModule.current || modules[0]?.id;
  const found = findEntry(modules, location.pathname);
  const crumbModule = found?.module || modules.find((module) => module.id === current);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  const user = auth.user;
  return (
    <div className={collapsed ? "admin-layout sidebar-collapsed" : "admin-layout"}>
      <AdminSidebar
        open={open}
        collapsed={collapsed}
        badges={badges}
        user={user}
        modules={modules}
        current={current}
        onToggle={onToggle}
        onLogout={onLogout}
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
              <span>{location.pathname === "/admin/security" ? "Mon compte" : crumbModule?.short}</span>
              <ChevronRight size={14} />
              <b>{location.pathname === "/admin/security" ? "Sécurité du compte" : found?.entry.label || "Administration"}</b>
            </span>
          </div>
          <div className="admin-topbar-actions">
            <ThemeToggle />
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
            <AccountMenu user={user} onLogout={onLogout} />
          </div>
        </header>
        <main className="admin-content">
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <Routes>
            <Route
              index
              element={admin.superAdmin ? <OverviewPage user={user} /> : <Navigate to={firstPath(modules)} replace />}
            />
            <Route path="security" element={<SecurityPage user={user} onSessionRenewed={onSessionRenewed} />} />

            {/* Administration générale */}
            <Route path="systeme/utilisateurs" element={<Guard superAdmin><UsersPage /></Guard>} />
            <Route path="systeme/securite" element={<Guard superAdmin><GlobalSecurityPage /></Guard>} />
            <Route path="systeme/rapports" element={<Guard superAdmin><GlobalReportsPage /></Guard>} />

            {/* Gestion du centre */}
            <Route path="centre" element={<Guard section="centre.dashboard"><DashboardPage user={user} /></Guard>} />
            {Object.keys(sections).map((resource) => (
              <Route
                key={resource}
                path={resource}
                element={
                  <Guard section={`centre.${resource}`}>
                    {resource === "assessments" ? <AssessmentsAdminPage /> : <ResourcePage key={resource} resource={resource} />}
                  </Guard>
                }
              />
            ))}

            {/* Ressources humaines */}
            <Route path="rh" element={<Guard section="rh.dashboard"><HrDashboard /></Guard>} />
            <Route path="rh/enseignants" element={<StaffPage key="teacher" kind="teacher" />} />
            <Route path="rh/employes" element={<StaffPage key="employee" kind="employee" />} />
            <Route path="rh/contrats" element={<Guard section="rh.contracts"><ContractsPage /></Guard>} />
            <Route path="rh/planning" element={<Guard section="rh.planning"><PlanningPage /></Guard>} />
            <Route path="rh/presences" element={<AttendancePage />} />
            <Route path="rh/conges" element={<LeavesPage />} />
            <Route path="rh/tarifs" element={<RatesPage />} />
            <Route path="rh/paie" element={<PayrollPage key="calc" mode="calc" />} />
            <Route path="rh/bulletins" element={<PayrollPage key="slips" mode="slips" />} />
            <Route path="rh/ajustements" element={<AdjustmentsPage />} />
            <Route path="rh/rapports" element={<Guard section="rh.reports"><HrReportsPage /></Guard>} />
            <Route path="rh/parametres" element={<HrSettingsPage />} />

            {/* Finances */}
            <Route path="finance" element={<Guard section="finance.dashboard"><FinanceDashboard /></Guard>} />
            <Route path="finance/tarifs" element={<FeesPage />} />
            <Route path="finance/eleves" element={<StudentsPage />} />
            <Route path="finance/encaissements" element={<CollectionsPage />} />
            <Route path="finance/remises" element={<DiscountsPage />} />
            <Route path="finance/encaisser" element={<RecordPaymentPage />} />
            <Route path="finance/echeanciers" element={<StudentAccountsPage />} />
            <Route path="finance/impayes" element={<ReceivablesPage />} />
            <Route path="finance/paiements" element={<PaymentsPage />} />
            <Route path="finance/factures" element={<Guard section={admin.can("finance.invoices") ? "finance.invoices" : "finance.payments"}><InvoicesPage /></Guard>} />
            <Route path="finance/salaires" element={<StaffPaymentsPage key="employee" kind="employee" />} />
            <Route path="finance/remunerations" element={<StaffPaymentsPage key="teacher" kind="teacher" />} />
            <Route path="finance/avances" element={<AdvancesPage />} />
            <Route path="finance/depenses" element={<ExpensesPage />} />
            <Route path="finance/depenses/nouvelle" element={<Guard section="finance.expenses" action="create"><ExpensesPage openNew /></Guard>} />
            <Route path="finance/categories" element={<Guard section={admin.can("finance.expenseCategories") ? "finance.expenseCategories" : "finance.expenses"}><CategoriesPage /></Guard>} />
            {ACCOUNT_PAGES.map((kind) => (
              <Route key={kind} path={`finance/comptes/${kind}`} element={<AccountsPage key={kind} kind={kind} />} />
            ))}
            <Route path="finance/transferts" element={<TransfersPage />} />
            <Route path="finance/rapports" element={<Guard section="finance.reports"><FinanceReportsPage /></Guard>} />
            <Route path="finance/parametres" element={<FinanceSettingsPage />} />

            {/* Espace students (application mobile) */}
            <Route path="eleves" element={<Guard section="eleves.access"><StudentAccessPage /></Guard>} />
            <Route path="eleves/cours" element={<Guard section="eleves.lessons"><LessonsPage /></Guard>} />
            <Route path="eleves/presences" element={<Guard section="eleves.attendance"><StudentAttendancePage /></Guard>} />
            <Route path="eleves/notes" element={<Guard section="eleves.grades"><GradesPage /></Guard>} />
            <Route path="eleves/annonces" element={<Guard section="eleves.announcements"><StudentAnnouncementsPage /></Guard>} />

            <Route
              path="*"
              element={
                <p>
                  Section introuvable. <Link to="/admin">Retour à l’accueil de l’administration</Link>
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

export default function AdminApp() {
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
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
  return (
    <AdminProvider user={auth.user}>
      <AdminShell
        auth={auth}
        badges={badges}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onLogout={logout}
        onSessionRenewed={applySession}
        error={error}
      />
    </AdminProvider>
  );
}
