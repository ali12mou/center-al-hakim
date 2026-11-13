import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  Clock3,
  Eye,
  EyeOff,
  History,
  Languages,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Monitor,
  Phone,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  Target,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { LOGO } from "../components/logoParts.js";
import { marketingApi, onMarketingAuthEvent, setMarketingCsrf } from "./marketingApi.js";
import {
  PROSPECT_STATUS,
  PROSPECT_TONE,
  PROSPECT_SOURCES,
  OPEN_STATUSES,
} from "../../../Backend/config/marketing.js";
import { passwordRules } from "../../../Backend/validators/password-policy.js";
import "./marketing.css";

const DEPARTMENT_ICONS = { Languages, BriefcaseBusiness, Monitor, ChartNoAxesCombined };
const BENEFIT_ICONS = { BookOpen, Users, Clock3, MapPin };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Djibouti" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Djibouti" });
const dayLabel = (value) => (value ? dateFormat.format(new Date(`${value}T12:00:00+03:00`)) : "");
const whatsappNumber = (phone = "") => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `253${digits}`;
  return digits.length >= 10 ? digits : "";
};

function Brand({ light }) {
  return (
    <Link to="/marketings" className={`mk-brand${light ? " light" : ""}`}>
      <span className="mk-logo">
        <svg viewBox="89 0 192 234" aria-hidden="true">
          <image href={LOGO} width="411" height="431" />
        </svg>
      </span>
      <span>
        <strong>AL-HAKIM CENTER</strong>
        <small>Espace marketing</small>
      </span>
    </Link>
  );
}
function ErrorLine({ error }) {
  return error ? (
    <p className="mk-error" role="alert">
      <TriangleAlert size={17} />
      {error}
    </p>
  ) : null;
}
function StatusPill({ status }) {
  return <span className={`mk-pill tone-${PROSPECT_TONE[status] || "new"}`}>{PROSPECT_STATUS[status] || status}</span>;
}

// ——————————————————— Page d’accueil ———————————————————
function Home({ user }) {
  const [catalogue, setCatalogue] = useState(null);
  useEffect(() => {
    fetch("/catalogue.json")
      .then((response) => (response.ok ? response.json() : null))
      .then(setCatalogue)
      .catch(() => setCatalogue(null));
  }, []);
  const centre = catalogue?.centre || {};
  const about = catalogue?.content?.about || {};
  const benefits = catalogue?.content?.benefits || [];
  const departments = catalogue?.departments || [];
  const courses = catalogue?.courses || [];
  const cta = user ? (
    <Link to="/marketings/dashboard" className="mk-button">
      Mon tableau de bord <ArrowRight size={18} />
    </Link>
  ) : (
    <Link to="/marketings/login" className="mk-button">
      Connexion agent marketing <ArrowRight size={18} />
    </Link>
  );
  return (
    <div className="mk-home">
      <header className="mk-topbar">
        <Brand light />
        {cta}
      </header>
      <section className="mk-hero">
        <div className="mk-hero-text">
          <span className="mk-kicker">Learn Today. Lead Tomorrow.</span>
          <h1>
            Présentez AL-HAKIM CENTER, <em>ouvrez des avenirs.</em>
          </h1>
          <p>
            {about.description ||
              "Centre de formation dédié au développement des compétences linguistiques, professionnelles et numériques à Djibouti."}
          </p>
          <div className="mk-hero-actions">
            {cta}
            <a href="#formations" className="mk-button mk-button-ghost">
              Nos domaines de formation
            </a>
          </div>
        </div>
        <div className="mk-hero-media">
          <img src="/images/hero-classroom.jpg" alt="Salle de formation AL-HAKIM CENTER" />
          <img src="/images/centre.jpg" alt="Le centre AL-HAKIM" />
        </div>
      </section>

      {about.mission && (
        <section className="mk-mission">
          <Target size={26} />
          <div>
            <span className="mk-kicker">Notre mission</span>
            <p>{about.mission}</p>
            {about.values?.length > 0 && (
              <ul>
                {about.values.map((value) => (
                  <li key={value}>
                    <Check size={15} />
                    {value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <section className="mk-section" id="formations">
        <span className="mk-kicker">Domaines de formation</span>
        <h2>Des formations utiles, accessibles et pratiques</h2>
        <div className="mk-domains">
          {departments.map((department) => {
            const Icon = DEPARTMENT_ICONS[department.icon] || BookOpen;
            const list = courses.filter((course) => course.department === department.id);
            return (
              <article key={department.id} className="mk-domain">
                <img src={`/images/${department.id}.jpg`} alt="" loading="lazy" />
                <div>
                  <span className="mk-domain-icon">
                    <Icon size={20} />
                  </span>
                  <h3>{department.name}</h3>
                  <p>{department.description}</p>
                  {list.length > 0 && (
                    <ul>
                      {list.slice(0, 5).map((course) => (
                        <li key={course.id}>{course.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {benefits.length > 0 && (
        <section className="mk-section mk-benefits-section">
          <span className="mk-kicker">Nos avantages</span>
          <h2>Pourquoi choisir AL-HAKIM CENTER ?</h2>
          <div className="mk-benefits">
            {benefits.map((benefit) => {
              const Icon = BENEFIT_ICONS[benefit.icon] || Check;
              return (
                <div key={benefit.title} className="mk-benefit">
                  <Icon size={22} />
                  <strong>{benefit.title}</strong>
                  <span>{benefit.text}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mk-cta">
        <div>
          <h2>Agent marketing ?</h2>
          <p>Connectez-vous pour enregistrer les personnes intéressées et suivre vos résultats.</p>
        </div>
        {cta}
      </section>
      <footer className="mk-footer">
        <span>
          {centre.address ? `${centre.address} · ` : ""}
          {centre.phone || ""}
        </span>
        <span>© {new Date().getFullYear()} AL-HAKIM CENTER</span>
      </footer>
    </div>
  );
}

// ——————————————————— Connexion ———————————————————
function AuthLayout({ children }) {
  return (
    <div className="mk-auth">
      <div className="mk-auth-top">
        <Link to="/marketings" className="mk-back">
          <ArrowLeft size={16} /> Accueil marketing
        </Link>
      </div>
      <div className="mk-auth-card">
        <Brand />
        {children}
        <p className="mk-secure">
          <ShieldCheck size={15} /> Connexion sécurisée · accès limité à vos données
        </p>
      </div>
    </div>
  );
}
function PasswordInput({ visible, onToggle, ...props }) {
  return (
    <span className="mk-input">
      <LockKeyhole size={18} />
      <input type={visible ? "text" : "password"} maxLength={128} required {...props} />
      <button type="button" onClick={onToggle} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
function Login({ notice, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await marketingApi("/auth/login", { method: "POST", body: { email, password } }));
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <form onSubmit={submit} className="mk-form">
        <h1>Connexion agent marketing</h1>
        <p className="mk-lead">Saisissez l’adresse e-mail et le mot de passe fournis par l’administration du centre.</p>
        {notice && !error && <p className="mk-notice">{notice}</p>}
        <label>
          Adresse e-mail
          <span className="mk-input">
            <Mail size={18} />
            <input type="email" autoComplete="username" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" />
          </span>
        </label>
        <label>
          Mot de passe
          <PasswordInput
            autoComplete="current-password"
            value={password}
            visible={visible}
            onToggle={() => setVisible(!visible)}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Votre mot de passe"
          />
        </label>
        <ErrorLine error={error} />
        <button className="mk-button mk-submit" disabled={busy}>
          {busy ? (
            <>
              Connexion… <LoaderCircle size={18} className="mk-spin" />
            </>
          ) : (
            <>
              Se connecter <ArrowRight size={18} />
            </>
          )}
        </button>
        <p className="mk-hint">Mot de passe oublié ? Demandez à l’administration de le réinitialiser.</p>
      </form>
    </AuthLayout>
  );
}

function PasswordStep({ user, onChanged, onLogout }) {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const context = { username: user.email.split("@")[0] };
  const strong = passwordRules.every((rule) => rule.test(values.newPassword, context));
  const matches = values.confirm && values.confirm === values.newPassword;
  const update = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    if (!strong || !matches) return;
    setBusy(true);
    setError("");
    try {
      onChanged(
        await marketingApi("/auth/password", {
          method: "POST",
          body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
        }),
      );
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <form onSubmit={submit} className="mk-form">
        <h1>Choisissez votre mot de passe</h1>
        <p className="mk-lead">
          Bienvenue {user.name}. Pour sécuriser votre compte, remplacez le mot de passe provisoire par un mot de passe personnel.
        </p>
        <input className="mk-sr-only" name="username" autoComplete="username" value={user.email} readOnly tabIndex={-1} aria-hidden="true" />
        <label>
          Mot de passe actuel (provisoire)
          <PasswordInput name="currentPassword" autoComplete="current-password" value={values.currentPassword} visible={visible} onToggle={() => setVisible(!visible)} onChange={update} />
        </label>
        <label>
          Nouveau mot de passe
          <PasswordInput name="newPassword" autoComplete="new-password" value={values.newPassword} visible={visible} onToggle={() => setVisible(!visible)} onChange={update} />
        </label>
        <ul className="mk-rules">
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
        <label>
          Confirmer le mot de passe
          <PasswordInput name="confirm" autoComplete="new-password" value={values.confirm} visible={visible} onToggle={() => setVisible(!visible)} onChange={update} />
        </label>
        {values.confirm && !matches && <small className="mk-mismatch">Les deux mots de passe ne correspondent pas.</small>}
        <ErrorLine error={error} />
        <button className="mk-button mk-submit" disabled={busy || !strong || !matches || !values.currentPassword}>
          Enregistrer et continuer <ArrowRight size={18} />
        </button>
        <button type="button" className="mk-link" onClick={onLogout}>
          Se déconnecter
        </button>
      </form>
    </AuthLayout>
  );
}

// ——————————————————— Tableau de bord ———————————————————
const emptyProspect = { name: "", phone: "", email: "", courseId: "", status: "new", source: "field", nextFollowUp: "", notes: "", consent: false };

function CollectForm({ user, courses, onSaved }) {
  const [values, setValues] = useState(emptyProspect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const set = (key) => (event) =>
    setValues((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await marketingApi("/prospects", {
        method: "POST",
        body: { ...values, nextFollowUp: OPEN_STATUSES.includes(values.status) ? values.nextFollowUp : "" },
      });
      setValues(emptyProspect);
      setSuccess(`${result.item.name} est enregistré (${result.item.reference}).`);
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="mk-panel mk-collect" onSubmit={submit}>
      <div className="mk-panel-head">
        <span className="mk-logo small">
          <svg viewBox="89 0 192 234" aria-hidden="true">
            <image href={LOGO} width="411" height="431" />
          </svg>
        </span>
        <div>
          <h2>Formulaire de collecte marketing</h2>
          <p>Enregistrement des personnes intéressées par nos formations</p>
        </div>
      </div>
      <div className="mk-grid">
        <label className="full">
          Nom complet <em>*</em>
          <input required minLength={2} maxLength={120} value={values.name} onChange={set("name")} placeholder="Prénom et nom" />
        </label>
        <label>
          Téléphone <em>*</em>
          <input type="tel" required maxLength={30} value={values.phone} onChange={set("phone")} placeholder="77 00 00 00" />
        </label>
        <label>
          E-mail
          <input type="email" maxLength={254} value={values.email} onChange={set("email")} placeholder="facultatif" />
        </label>
        <label className="full">
          Compétence ou formation souhaitée <em>*</em>
          <select required value={values.courseId} onChange={set("courseId")}>
            <option value="">Choisir une formation</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Statut
          <select value={values.status} onChange={set("status")}>
            {Object.entries(PROSPECT_STATUS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select value={values.source} onChange={set("source")}>
            {Object.entries(PROSPECT_SOURCES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date de collecte
          <input value={`Automatique · ${dateFormat.format(new Date())}`} readOnly className="mk-auto" />
        </label>
        <label>
          Agent marketing
          <input value={user.name} readOnly className="mk-auto" />
        </label>
        {OPEN_STATUSES.includes(values.status) && (
          <label>
            Prochaine relance
            <input type="date" value={values.nextFollowUp} onChange={set("nextFollowUp")} />
          </label>
        )}
        <label className="full">
          Observations
          <textarea rows={3} maxLength={2000} value={values.notes} onChange={set("notes")} placeholder="Disponibilités, niveau, questions…" />
        </label>
        <label className="full mk-check">
          <input type="checkbox" checked={values.consent} onChange={set("consent")} />
          <span>La personne accepte de recevoir les informations et offres d’AL-HAKIM CENTER.</span>
        </label>
      </div>
      <ErrorLine error={error} />
      {success && (
        <p className="mk-success" role="status">
          <Check size={17} /> {success}
        </p>
      )}
      <button className="mk-button mk-submit" disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer le prospect"} <Send size={17} />
      </button>
    </form>
  );
}

function StatusEditor({ prospect, onSaved, onCancel }) {
  const [status, setStatus] = useState(prospect.status);
  const [note, setNote] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState(prospect.nextFollowUp || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await marketingApi(`/prospects/${prospect._id}/status`, {
        method: "POST",
        body: { status, note, nextFollowUp: OPEN_STATUSES.includes(status) ? nextFollowUp : "" },
      });
      onSaved();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  return (
    <div className="mk-status-editor">
      <div className="mk-grid">
        <label>
          Nouveau statut
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(PROSPECT_STATUS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {OPEN_STATUSES.includes(status) && (
          <label>
            Prochaine relance
            <input type="date" value={nextFollowUp} onChange={(event) => setNextFollowUp(event.target.value)} />
          </label>
        )}
        <label className="full">
          Commentaire
          <input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex. : rappelé, visite prévue samedi…" />
        </label>
      </div>
      <ErrorLine error={error} />
      <div className="mk-row-actions">
        <button className="mk-button small" disabled={busy} onClick={save}>
          {busy ? "…" : "Enregistrer"}
        </button>
        <button className="mk-link" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function HistoryList({ prospect }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    marketingApi(`/prospects/${prospect._id}/history`)
      .then((result) => setItems(result.items))
      .catch(() => setItems([]));
  }, [prospect._id, prospect.status]);
  if (!items) return <p className="mk-muted">Chargement…</p>;
  return (
    <ol className="mk-history">
      {items.map((item) => (
        <li key={item._id}>
          <StatusPill status={item.to} />
          <span>
            {dateTimeFormat.format(new Date(item.createdAt))} · {item.by?.name}
            {item.by?.kind === "admin" ? " (administration)" : ""}
            {item.note ? ` — ${item.note}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ProspectRow({ prospect, onChanged }) {
  const [open, setOpen] = useState("");
  const whatsapp = whatsappNumber(prospect.phone);
  return (
    <li className="mk-prospect">
      <div className="mk-prospect-main">
        <div>
          <strong>{prospect.name}</strong>
          <span className="mk-ref">{prospect.reference}</span>
          <small>
            {prospect.courseTitle} · {dateFormat.format(new Date(prospect.createdAt))} · {PROSPECT_SOURCES[prospect.source]}
          </small>
          <small>
            {prospect.phone}
            {prospect.email ? ` · ${prospect.email}` : ""}
          </small>
        </div>
        <div className="mk-prospect-side">
          <StatusPill status={prospect.status} />
          {prospect.nextFollowUp && OPEN_STATUSES.includes(prospect.status) && (
            <small className="mk-followup">Relance {dayLabel(prospect.nextFollowUp)}</small>
          )}
        </div>
      </div>
      <div className="mk-row-actions">
        <a className="mk-chip" href={`tel:${prospect.phone.replace(/[^\d+]/g, "")}`}>
          <Phone size={14} /> Appeler
        </a>
        {whatsapp && (
          <a className="mk-chip" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        <button className={`mk-chip${open === "status" ? " active" : ""}`} onClick={() => setOpen(open === "status" ? "" : "status")}>
          <ListChecks size={14} /> Changer le statut
        </button>
        <button className={`mk-chip${open === "history" ? " active" : ""}`} onClick={() => setOpen(open === "history" ? "" : "history")}>
          <History size={14} /> Historique
        </button>
      </div>
      {open === "status" && (
        <StatusEditor
          prospect={prospect}
          onCancel={() => setOpen("")}
          onSaved={() => {
            setOpen("");
            onChanged();
          }}
        />
      )}
      {open === "history" && <HistoryList prospect={prospect} />}
    </li>
  );
}

function Dashboard({ user, onLogout }) {
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    marketingApi("/courses").then((result) => setCourses(result.items)).catch(() => {});
  }, []);
  useEffect(() => {
    marketingApi("/stats").then(setStats).catch((failure) => setError(failure.message));
  }, [version]);
  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const timer = setTimeout(() => {
      marketingApi(`/prospects?${params}`)
        .then((result) => {
          setList(result);
          setError("");
        })
        .catch((failure) => setError(failure.message));
    }, 200);
    return () => clearTimeout(timer);
  }, [q, status, page, version]);
  const tiles = [
    { icon: Users, label: "Prospects collectés", value: stats?.total ?? "—", note: "Nombre total", tone: "navy" },
    { icon: Target, label: "Prospects intéressés", value: stats?.interested ?? "—", note: "Intérêt confirmé", tone: "blue" },
    {
      icon: UserCheck,
      label: "Inscriptions réalisées",
      value: stats?.enrolled ?? "—",
      note: `Conversion ${String(stats?.conversion ?? 0).replace(".", ",")} %`,
      tone: "teal",
    },
    { icon: PhoneCall, label: "Relances à effectuer", value: stats?.followUps ?? "—", note: "Suivi quotidien", tone: "pink", filter: "followup" },
  ];
  return (
    <div className="mk-dashboard">
      <header className="mk-topbar mk-topbar-app">
        <Brand light />
        <div className="mk-user">
          <span className="mk-avatar">
            <UserRound size={18} />
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.reference}</small>
          </span>
          <button className="mk-icon-button" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="mk-main">
        <div className="mk-welcome">
          <h1>Bonjour {user.name.split(" ")[0]} 👋</h1>
          <p>Vos statistiques personnelles et vos prospects collectés.</p>
        </div>
        <div className="mk-stats">
          {tiles.map(({ icon: Icon, label, value, note, tone, filter }) => (
            <button
              key={label}
              type="button"
              className={`mk-stat tone-${tone}${filter && status === filter ? " active" : ""}`}
              onClick={() => {
                if (!filter) return;
                setStatus(status === filter ? "" : filter);
                setPage(1);
              }}
            >
              <span className="mk-stat-icon">
                <Icon size={20} />
              </span>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </button>
          ))}
        </div>
        {error && <ErrorLine error={error} />}
        <div className="mk-columns">
          <CollectForm
            user={user}
            courses={courses}
            onSaved={() => {
              setPage(1);
              reload();
            }}
          />
          <section className="mk-panel">
            <div className="mk-list-head">
              <h2>Mes prospects</h2>
              <span className="mk-count">{list?.total ?? 0}</span>
            </div>
            <div className="mk-filters">
              <label className="mk-search">
                <Search size={16} />
                <input
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Nom, téléphone, e-mail…"
                  aria-label="Rechercher"
                />
              </label>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                aria-label="Statut"
              >
                <option value="">Tous les statuts</option>
                <option value="followup">Relances à effectuer</option>
                {Object.entries(PROSPECT_STATUS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {!list ? (
              <p className="mk-muted">Chargement…</p>
            ) : list.items.length === 0 ? (
              <p className="mk-empty">Aucun prospect pour le moment. Utilisez le formulaire pour enregistrer votre premier contact.</p>
            ) : (
              <ul className="mk-prospects">
                {list.items.map((prospect) => (
                  <ProspectRow key={prospect._id} prospect={prospect} onChanged={reload} />
                ))}
              </ul>
            )}
            {list?.pages > 1 && (
              <div className="mk-pager">
                <button className="mk-chip" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Précédent
                </button>
                <span>
                  Page {page} / {list.pages}
                </span>
                <button className="mk-chip" disabled={page >= list.pages} onClick={() => setPage(page + 1)}>
                  Suivant
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ——————————————————— Application ———————————————————
export default function MarketingApp() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, user: null });
  const [notice, setNotice] = useState("");
  const accept = useCallback((result) => {
    setMarketingCsrf(result.csrfToken);
    setState({ loading: false, user: result.user });
  }, []);
  useEffect(() => {
    marketingApi("/auth/status")
      .then(accept)
      .catch(() => setState({ loading: false, user: null }));
  }, [accept]);
  useEffect(
    () =>
      onMarketingAuthEvent((event) => {
        if (event.type === "expired") {
          setMarketingCsrf("");
          setState({ loading: false, user: null });
          setNotice(event.message);
          navigate("/marketings/login");
        }
        if (event.type === "password")
          setState((current) => (current.user ? { ...current, user: { ...current.user, mustChangePassword: true } } : current));
      }),
    [navigate],
  );
  const logout = useMemo(
    () => async () => {
      try {
        await marketingApi("/auth/logout", { method: "POST" });
      } catch {
        /* session déjà fermée */
      }
      setMarketingCsrf("");
      setState({ loading: false, user: null });
      setNotice("Vous êtes déconnecté.");
      navigate("/marketings/login");
    },
    [navigate],
  );
  useEffect(() => {
    document.title = "Espace marketing · AL-HAKIM CENTER";
  }, []);
  if (state.loading)
    return (
      <div className="mk-loading">
        <LoaderCircle size={28} className="mk-spin" />
      </div>
    );
  const { user } = state;
  return (
    <Routes>
      <Route index element={<Home user={user} />} />
      <Route
        path="login"
        element={
          user ? (
            <Navigate to="/marketings/dashboard" replace />
          ) : (
            <Login
              notice={notice}
              onLogin={(result) => {
                setNotice("");
                accept(result);
                navigate("/marketings/dashboard");
              }}
            />
          )
        }
      />
      <Route
        path="dashboard"
        element={
          !user ? (
            <Navigate to="/marketings/login" replace />
          ) : user.mustChangePassword ? (
            <PasswordStep user={user} onChanged={accept} onLogout={logout} />
          ) : (
            <Dashboard user={user} onLogout={logout} />
          )
        }
      />
      <Route path="*" element={<Navigate to="/marketings" replace />} />
    </Routes>
  );
}
