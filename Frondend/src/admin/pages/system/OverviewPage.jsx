import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeading } from "../../components/ui.jsx";
import { useRemote } from "../../hooks/useRemote.js";
import { money, monthLabel, thisMonth } from "../../lib/format.js";

const today = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Djibouti",
});

function ModuleCard({ icon: Icon, tone, title, description, to, facts, loading, error }) {
  return (
    <section className={`module-card tone-${tone}`}>
      <header>
        <span className="module-card-icon">
          <Icon size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {error ? (
        <p className="dashboard-zero">{error}</p>
      ) : (
        <dl className={loading ? "module-facts is-loading" : "module-facts"}>
          {facts.map(([label, value, note]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{loading ? "…" : value}</dd>
              {note && !loading && <small>{note}</small>}
            </div>
          ))}
        </dl>
      )}
      <Link to={to} className="panel-footer-link">
        Ouvrir le tableau de bord <ArrowRight size={15} />
      </Link>
    </section>
  );
}

export default function OverviewPage({ user }) {
  const centre = useRemote("/dashboard");
  const rh = useRemote("/rh/dashboard");
  const finance = useRemote("/finance/dashboard");
  const security = useRemote("/system/security/overview");
  const date = today.format(new Date());
  const c = centre.data?.counts;
  const r = rh.data;
  const f = finance.data?.totals;
  const s = security.data;
  return (
    <>
      <PageHeading
        kicker={date.charAt(0).toUpperCase() + date.slice(1)}
        title={`Bonjour ${user.name.split(" ")[0]}.`}
        description="Vue générale d’AL-HAKIM CENTER : les trois espaces de gestion et la sécurité de l’application."
      >
        <Link to="/admin/systeme/utilisateurs" className="button button-outline">
          <UserCog size={17} /> Utilisateurs et droits
        </Link>
        <Link to="/admin/systeme/rapports" className="button">
          <BarChart3 size={17} /> Rapports généraux
        </Link>
      </PageHeading>
      <div className="module-cards">
        <ModuleCard
          icon={Building2}
          tone="navy"
          title="Gestion du centre"
          description="Inscriptions, contacts, formations et contenu du site."
          to="/admin/centre"
          loading={!c}
          error={centre.error}
          facts={[
            ["Inscrits", c?.registrations, `${c?.newRegistrations} nouvelle(s) demande(s)`],
            ["Contacts à traiter", c?.unread, `${c?.contacts} au total`],
            ["Formations publiées", c?.published, `${c?.courses} au total`],
            ["Inscriptions ce mois-ci", c?.thisMonth, `${c?.lastMonth} le mois dernier`],
          ]}
        />
        <ModuleCard
          icon={Users}
          tone="blue"
          title="Ressources humaines"
          description="Enseignants, employés, plannings, présences, congés et paie."
          to="/admin/rh"
          loading={!r}
          error={rh.error}
          facts={[
            ["Enseignants actifs", r?.counts.teachers],
            ["Employés actifs", r?.counts.employees],
            ["Congés à valider", r?.counts.pendingLeaves, `${r?.counts.onLeave} absent(s) aujourd’hui`],
            [`Paie de ${monthLabel(thisMonth()).toLowerCase()}`, money(r?.payroll.net), `${money(r?.payroll.paid)} déjà versés`],
          ]}
        />
        <ModuleCard
          icon={Wallet}
          tone="green"
          title="Finances"
          description="Frais de formation, paiements, factures, salaires, dépenses et comptes."
          to="/admin/finance"
          loading={!f}
          error={finance.error}
          facts={[
            ["Encaissé ce mois-ci", money(f?.collected)],
            ["Reste à recevoir", money(f?.receivable), `${money(f?.overdueAmount)} en retard`],
            ["Dépenses du mois", money(f?.expenses), `${f?.pendingExpenses} à valider`],
            ["Salaires restant à verser", money(f?.salariesDue), `${f?.pendingStaff} paiement(s) en cours`],
          ]}
        />
        <ModuleCard
          icon={ShieldCheck}
          tone="pink"
          title="Sécurité"
          description="Comptes, connexions, sessions et appels à l’API."
          to="/admin/systeme/securite"
          loading={!s}
          error={security.error}
          facts={[
            ["Comptes actifs", s?.users.active, `${s?.users.admins} administrateur(s) général(aux)`],
            ["Sessions ouvertes", s?.sessions],
            ["Échecs de connexion (24 h)", s?.failures24h, `${s?.locked} identifiant(s) bloqué(s)`],
            ["Appels API (24 h)", s?.calls24h, `${s?.forbidden24h} accès refusé(s)`],
          ]}
        />
      </div>
    </>
  );
}
