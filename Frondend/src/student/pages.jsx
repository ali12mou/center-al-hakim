import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Link2,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Pin,
  ReceiptText,
  Smartphone,
  Video,
  Wallet,
} from "lucide-react";
import { PAYMENT_METHODS, dayLabel, money as formatMoney } from "../admin/lib/format.js";
import { PasswordForm, useInstallPrompt, useStudent, useStudentData } from "./shared.jsx";
import { lessonFileUrl } from "./studentApi.js";

const PAY_STATUS = {
  paid: ["Soldé", "ok"],
  partial: ["En cours", "info"],
  unpaid: ["À payer", "info"],
  overdue: ["En retard", "danger"],
  upcoming: ["À venir", "info"],
  cancelled: ["Annulé", "muted"],
};
const ATTENDANCE = {
  present: ["Présent", "ok"],
  late: ["En retard", "warn"],
  absent: ["Absent", "danger"],
  excused: ["Absence excusée", "muted"],
};
const KIND = {
  lesson: ["Leçon", BookOpen],
  document: ["Document", FileText],
  video: ["Vidéo", Video],
  link: ["Lien", Link2],
};

// Nombres à la française : 14,8 et non 14.8.
const decimal = (value) => String(value).replace(".", ",");

function Pill({ map, status }) {
  const [label, tone] = map[status] || [status, "muted"];
  return <span className={`st-pill st-pill-${tone}`}>{label}</span>;
}
function Loading({ error, onRetry }) {
  if (error)
    return (
      <div className="st-card st-center">
        <p className="st-error">{error}</p>
        {onRetry && (
          <button className="st-button st-button-ghost" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    );
  return (
    <div className="st-skeleton" aria-label="Chargement…" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="st-empty">
      <Icon size={30} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}
function PageTitle({ title, subtitle }) {
  return (
    <div className="st-page-title">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
// Texte saisi par le centre : affiché tel quel (retours à la ligne conservés), jamais en HTML.
const Text = ({ children, className = "" }) => <p className={`st-text ${className}`}>{children}</p>;

function useMe() {
  return useStudentData("/me");
}

export function HomePage() {
  const { user } = useStudent();
  const me = useMe();
  const progress = useStudentData("/progress");
  const news = useStudentData("/announcements");
  const first = user.name.split(" ")[0];
  const accounts = me.data?.accounts || [];
  const money = (value) => formatMoney(value, me.data?.currency);
  const balance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const next = accounts
    .map((account) => account.nextDue && { ...account.nextDue, course: account.courseTitle })
    .filter(Boolean)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const overdue = accounts.reduce((sum, account) => sum + account.overdueAmount, 0);
  const stats = progress.data?.stats;
  return (
    <>
      <section className="st-hero">
        <span>Bonjour,</span>
        <h1>{first} 👋</h1>
        <p>Retrouvez ici vos cours, votre progression et vos paiements.</p>
      </section>
      {me.error ? (
        <Loading error={me.error} onRetry={me.reload} />
      ) : !me.data ? (
        <Loading />
      ) : (
        <>
          <h2 className="st-section">Mes formations</h2>
          {accounts.length ? (
            <div className="st-list">
              {accounts.map((account) => (
                <Link key={account.id} to="/etudiant/cours" className="st-card st-course-card">
                  <span className="st-course-icon">
                    <BookOpen size={20} />
                  </span>
                  <span>
                    <strong>{account.courseTitle || "Formation"}</strong>
                    <small>
                      Début : {dayLabel(account.startDate)}
                      {account.course?.duration ? ` · ${account.course.duration}` : ""}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              icon={BookOpen}
              title="Aucune formation liée à votre compte"
              text="Contactez le centre pour vérifier votre dossier."
            />
          )}

          <div className="st-tiles">
            <Link to="/etudiant/suivi" className="st-tile">
              <CalendarCheck size={20} />
              <strong>{stats?.rate ?? "—"}{stats?.rate !== null && stats?.rate !== undefined ? " %" : ""}</strong>
              <span>Présence</span>
            </Link>
            <Link to="/etudiant/suivi" className="st-tile">
              <Award size={20} />
              <strong>{stats?.average !== null && stats?.average !== undefined ? `${decimal(stats.average)}/20` : "—"}</strong>
              <span>Moyenne</span>
            </Link>
            <Link to="/etudiant/paiements" className={`st-tile ${overdue ? "st-tile-alert" : ""}`}>
              <Wallet size={20} />
              <strong>{money(balance)}</strong>
              <span>{overdue ? `dont ${money(overdue)} en retard` : "Reste à payer"}</span>
            </Link>
          </div>
          {next && (
            <Link to="/etudiant/paiements" className="st-card st-due">
              <span>Prochaine échéance</span>
              <strong>
                {dayLabel(next.dueDate)} · {money(next.amount)}
              </strong>
              <small>{next.course}</small>
            </Link>
          )}
        </>
      )}

      <div className="st-section-row">
        <h2 className="st-section">Annonces</h2>
        <Link to="/etudiant/annonces">Tout voir</Link>
      </div>
      {news.data ? (
        news.data.items.length ? (
          <div className="st-list">
            {news.data.items.slice(0, 3).map((item) => (
              <AnnouncementCard key={item._id} item={item} accounts={accounts} compact />
            ))}
          </div>
        ) : (
          <Empty icon={Megaphone} title="Aucune annonce pour le moment" />
        )
      ) : (
        <Loading error={news.error} />
      )}
    </>
  );
}

function AnnouncementCard({ item, accounts = [], compact }) {
  const course = accounts.find((account) => account.courseId === item.courseId)?.courseTitle;
  return (
    <article className={`st-card st-announcement ${item.pinned ? "is-pinned" : ""}`}>
      <header>
        {item.pinned && <Pin size={15} aria-label="Épinglée" />}
        <strong>{item.title}</strong>
      </header>
      <small>
        {dayLabel(item.date)} · {item.courseId ? course || "Votre formation" : "Tous les students"}
      </small>
      {item.body && <Text className={compact ? "st-clamp" : ""}>{item.body}</Text>}
    </article>
  );
}

export function AnnouncementsPage() {
  const news = useStudentData("/announcements");
  const me = useMe();
  return (
    <>
      <PageTitle title="Annonces" subtitle="Informations du centre : horaires, examens, événements." />
      {!news.data ? (
        <Loading error={news.error} onRetry={news.reload} />
      ) : news.data.items.length ? (
        <div className="st-list">
          {news.data.items.map((item) => (
            <AnnouncementCard key={item._id} item={item} accounts={me.data?.accounts} />
          ))}
        </div>
      ) : (
        <Empty icon={Megaphone} title="Aucune annonce pour le moment" />
      )}
    </>
  );
}

function LessonCard({ lesson }) {
  const [open, setOpen] = useState(false);
  const [label, Icon] = KIND[lesson.kind] || KIND.lesson;
  const hasDetails = Boolean(lesson.body || lesson.description);
  return (
    <article className="st-card st-lesson">
      <button type="button" className="st-lesson-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`st-lesson-icon kind-${lesson.kind}`}>
          <Icon size={19} />
        </span>
        <span>
          <strong>{lesson.title}</strong>
          <small>
            {label}
            {lesson.date ? ` · ${dayLabel(lesson.date)}` : ""}
          </small>
        </span>
        {hasDetails && <ChevronDown size={18} className={open ? "is-open" : ""} />}
      </button>
      {open && lesson.description && <Text className="st-muted">{lesson.description}</Text>}
      {open && lesson.body && <Text>{lesson.body}</Text>}
      {(lesson.hasFile || lesson.link) && (
        <div className="st-lesson-actions">
          {lesson.hasFile && (
            <a className="st-button st-button-small" href={lessonFileUrl(lesson._id)} target="_blank" rel="noreferrer">
              <Download size={16} /> {lesson.fileType === "pdf" ? "Télécharger le PDF" : "Voir l’image"}
            </a>
          )}
          {lesson.link && (
            <a className="st-button st-button-small st-button-ghost" href={lesson.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> {lesson.kind === "video" ? "Regarder la vidéo" : "Ouvrir le lien"}
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export function CoursesPage() {
  const lessons = useStudentData("/lessons");
  const me = useMe();
  const accounts = me.data?.accounts || [];
  const courses = [...new Map(accounts.filter((a) => a.courseId).map((a) => [a.courseId, a.courseTitle])).entries()];
  const [filter, setFilter] = useState("");
  const items = (lessons.data?.items || []).filter((lesson) => !filter || lesson.courseId === filter);
  const groups = courses
    .filter(([id]) => !filter || id === filter)
    .map(([id, title]) => [id, title, items.filter((lesson) => lesson.courseId === id)]);
  return (
    <>
      <PageTitle title="Mes cours" subtitle="Leçons, documents, vidéos et liens partagés par vos formateurs." />
      {courses.length > 1 && (
        <div className="st-chips" role="tablist">
          <button role="tab" aria-selected={!filter} className={!filter ? "active" : ""} onClick={() => setFilter("")}>
            Toutes
          </button>
          {courses.map(([id, title]) => (
            <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
              {title}
            </button>
          ))}
        </div>
      )}
      {!lessons.data || !me.data ? (
        <Loading error={lessons.error || me.error} onRetry={lessons.reload} />
      ) : !courses.length ? (
        <Empty icon={BookOpen} title="Aucune formation liée à votre compte" text="Contactez le centre pour vérifier votre dossier." />
      ) : (
        groups.map(([id, title, list]) => (
          <section key={id}>
            {courses.length > 1 && !filter && <h2 className="st-section">{title}</h2>}
            {list.length ? (
              <div className="st-list">
                {list.map((lesson) => (
                  <LessonCard key={lesson._id} lesson={lesson} />
                ))}
              </div>
            ) : (
              <Empty icon={BookOpen} title="Pas encore de contenu" text={`Les cours de « ${title} » apparaîtront ici dès que le centre les publiera.`} />
            )}
          </section>
        ))
      )}
    </>
  );
}

export function ProgressPage() {
  const progress = useStudentData("/progress");
  const me = useMe();
  const [tab, setTab] = useState("grades");
  const titleOf = (courseId) => me.data?.accounts.find((account) => account.courseId === courseId)?.courseTitle || "";
  if (!progress.data) return (
    <>
      <PageTitle title="Mon suivi" />
      <Loading error={progress.error} onRetry={progress.reload} />
    </>
  );
  const { stats, grades, attendance } = progress.data;
  return (
    <>
      <PageTitle title="Mon suivi" subtitle="Vos notes et vos présences, mises à jour par le centre." />
      <div className="st-tiles">
        <div className="st-tile">
          <Award size={20} />
          <strong>{stats.average !== null ? `${decimal(stats.average)}/20` : "—"}</strong>
          <span>Moyenne</span>
        </div>
        <div className="st-tile">
          <CalendarCheck size={20} />
          <strong>{stats.rate ?? "—"}{stats.rate !== null ? " %" : ""}</strong>
          <span>Présence</span>
        </div>
        <div className="st-tile">
          <strong>{stats.absent}</strong>
          <span>Absence{stats.absent > 1 ? "s" : ""}</span>
          <small>{stats.late} retard{stats.late > 1 ? "s" : ""}</small>
        </div>
      </div>
      <div className="st-chips" role="tablist">
        <button role="tab" aria-selected={tab === "grades"} className={tab === "grades" ? "active" : ""} onClick={() => setTab("grades")}>
          Notes ({grades.length})
        </button>
        <button role="tab" aria-selected={tab === "attendance"} className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>
          Présences ({attendance.length})
        </button>
      </div>
      {tab === "grades" ? (
        grades.length ? (
          <div className="st-list">
            {grades.map((grade) => {
              const ratio = grade.score / grade.maxScore;
              return (
                <article key={grade._id} className="st-card st-grade">
                  <span className={`st-score ${ratio >= 0.5 ? "good" : "low"}`}>
                    <b>{decimal(grade.score)}</b>/{grade.maxScore}
                  </span>
                  <span>
                    <strong>{grade.title}</strong>
                    <small>
                      {dayLabel(grade.date)}
                      {titleOf(grade.courseId) ? ` · ${titleOf(grade.courseId)}` : ""}
                    </small>
                    {grade.comment && <Text className="st-muted">{grade.comment}</Text>}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty icon={Award} title="Aucune note pour le moment" />
        )
      ) : attendance.length ? (
        <div className="st-card st-rows">
          {attendance.map((row) => (
            <div key={row._id} className="st-row">
              <span>
                <strong>{dayLabel(row.date)}</strong>
                <small>{titleOf(row.courseId)}{row.notes ? ` · ${row.notes}` : ""}</small>
              </span>
              <Pill map={ATTENDANCE} status={row.status} />
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={CalendarCheck} title="Aucune présence enregistrée pour le moment" />
      )}
    </>
  );
}

export function PaymentsPage() {
  const me = useMe();
  if (!me.data)
    return (
      <>
        <PageTitle title="Mes paiements" />
        <Loading error={me.error} onRetry={me.reload} />
      </>
    );
  const { accounts, payments, invoices, currency } = me.data;
  const money = (value) => formatMoney(value, currency);
  return (
    <>
      <PageTitle title="Mes paiements" subtitle="Montant de votre formation, échéancier et reçus." />
      {!accounts.length && <Empty icon={Wallet} title="Aucun dossier financier" text="Contactez le centre pour plus d’informations." />}
      {accounts.map((account) => {
        const percent = account.totalAmount ? Math.min(100, Math.round((account.paidAmount / account.totalAmount) * 100)) : 0;
        const mine = payments.filter((payment) => payment.accountId === account.id);
        const bills = invoices.filter((invoice) => invoice.accountId === account.id);
        return (
          <section key={account.id} className="st-card st-account">
            <header>
              <span>
                <strong>{account.courseTitle || "Formation"}</strong>
                <small>Dossier {account.reference}</small>
              </span>
              <Pill map={PAY_STATUS} status={account.paymentStatus} />
            </header>
            <div className="st-progress" aria-label={`${percent} % payé`}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <dl className="st-facts">
              <div>
                <dt>Total</dt>
                <dd>{money(account.totalAmount)}</dd>
              </div>
              <div>
                <dt>Payé</dt>
                <dd>{money(account.paidAmount)}</dd>
              </div>
              <div>
                <dt>Reste</dt>
                <dd>
                  <b>{money(account.balance)}</b>
                </dd>
              </div>
            </dl>
            {account.discountAmount > 0 && <p className="st-hint">Remise accordée : {money(account.discountAmount)}</p>}
            <h3>Échéancier</h3>
            <div className="st-rows">
              {account.schedule.map((row, index) => (
                <div key={index} className="st-row">
                  <span>
                    <strong>{row.label}</strong>
                    <small>
                      {dayLabel(row.dueDate)} · {money(row.amount)}
                      {row.paid > 0 && row.remaining > 0 ? ` · reste ${money(row.remaining)}` : ""}
                    </small>
                  </span>
                  <Pill map={PAY_STATUS} status={row.status} />
                </div>
              ))}
            </div>
            <h3>Paiements reçus</h3>
            {mine.length ? (
              <div className="st-rows">
                {mine.map((payment) => (
                  <div key={payment.id} className="st-row">
                    <span>
                      <strong>{money(payment.amount)}</strong>
                      <small>
                        {dayLabel(payment.date)} · Reçu {payment.receiptNumber}
                        {payment.methods.length ? ` · ${payment.methods.map((method) => PAYMENT_METHODS[method] || method).join(" + ")}` : ""}
                      </small>
                    </span>
                    {payment.status === "pending" && <span className="st-pill st-pill-warn">En vérification</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="st-hint">Aucun paiement enregistré pour ce dossier.</p>
            )}
            {bills.length > 0 && (
              <>
                <h3>Factures</h3>
                <div className="st-rows">
                  {bills.map((invoice) => (
                    <div key={invoice.id} className="st-row">
                      <span>
                        <strong>
                          <ReceiptText size={14} /> {invoice.number}
                        </strong>
                        <small>
                          Émise le {dayLabel(invoice.issueDate)}
                          {invoice.dueDate ? ` · à régler avant le ${dayLabel(invoice.dueDate)}` : ""}
                        </small>
                      </span>
                      <b>{money(invoice.total)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}
      <p className="st-hint">Pour un reçu imprimé ou une question sur un paiement, adressez-vous à l’accueil du centre.</p>
    </>
  );
}

export function ProfilePage() {
  const { user, logout, applySession } = useStudent();
  const { canInstall, ios, standalone, install } = useInstallPrompt();
  const [changing, setChanging] = useState(false);
  const [done, setDone] = useState("");
  const [centre, setCentre] = useState(null);
  useEffect(() => {
    fetch(`${(import.meta.env.VITE_API_URL || "").replace(/\/$/, "")}/api/centre`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setCentre(data?.centre || null))
      .catch(() => {});
  }, []);
  return (
    <>
      <PageTitle title="Mon profil" />
      <section className="st-card st-profile">
        <span className="st-avatar">
          {user.name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
        </span>
        <span>
          <strong>{user.name}</strong>
          <small>Identifiant : {user.username}</small>
          {user.phone && <small>{user.phone}</small>}
          {user.email && <small>{user.email}</small>}
        </span>
      </section>

      <section className="st-card">
        <h3>Mot de passe</h3>
        {done && <p className="st-notice">{done}</p>}
        {changing ? (
          <PasswordForm
            user={user}
            onChanged={(value) => {
              applySession(value);
              setChanging(false);
              setDone("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
            }}
          />
        ) : (
          <button className="st-button st-button-ghost" onClick={() => setChanging(true)}>
            Changer mon mot de passe
          </button>
        )}
      </section>

      {!standalone && (canInstall || ios) && (
        <section className="st-card">
          <h3>
            <Smartphone size={17} /> Application
          </h3>
          {canInstall ? (
            <button className="st-button" onClick={install}>
              Installer sur ce téléphone
            </button>
          ) : (
            <p className="st-hint">
              Sur iPhone : touchez <b>Partager</b> puis <b>« Sur l’écran d’accueil »</b>.
            </p>
          )}
        </section>
      )}

      {centre && (
        <section className="st-card">
          <h3>Contacter le centre</h3>
          <div className="st-contact">
            <a href={`tel:${centre.phoneLink}`}>
              <Phone size={17} /> {centre.phone}
            </a>
            <a href={`https://wa.me/${centre.whatsapp}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} /> WhatsApp
            </a>
            <a href={`mailto:${centre.email}`}>
              <Mail size={17} /> {centre.email}
            </a>
          </div>
        </section>
      )}

      <button className="st-button st-button-danger" onClick={logout}>
        <LogOut size={18} /> Se déconnecter
      </button>
    </>
  );
}
