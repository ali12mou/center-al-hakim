import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  ClipboardCheck,
  Coins,
  FileSignature,
  FileText,
  GraduationCap,
  Handshake,
  HandCoins,
  House,
  Info,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Newspaper,
  PiggyBank,
  ReceiptText,
  Repeat,
  Settings,
  ShieldCheck,
  Smartphone,
  SquarePen,
  Tags,
  UserCog,
  UserRound,
  Users,
  Wallet,
  WalletCards,
  BadgePercent,
  Banknote,
  CircleDollarSign,
  CreditCard,
  FolderOpen,
  Calculator,
  ListChecks,
  KeyRound,
  Megaphone,
  School,
} from "lucide-react";

// Menus des quatre espaces. `section` : permission « consulter » requise
// (voir Backend/config/permissions.js) ; `badge` : compteur de /badges.
const item = (path, label, icon, section, extra = {}) => ({ path, label, icon, section, ...extra });

export const MODULE_MENUS = [
  {
    id: "system",
    label: "Administration générale",
    short: "Général",
    icon: LayoutGrid,
    home: "/admin",
    superAdmin: true,
    groups: [
      { label: "Pilotage", items: [item("/admin", "Vue générale", LayoutGrid)] },
      {
        label: "Accès et sécurité",
        items: [
          item("/admin/systeme/utilisateurs", "Utilisateurs et droits", UserCog),
          item("/admin/systeme/securite", "Sécurité de l’application", ShieldCheck),
        ],
      },
      {
        label: "Analyse",
        items: [item("/admin/systeme/rapports", "Rapports généraux", BarChart3)],
      },
    ],
  },
  {
    id: "centre",
    label: "Gestion du centre",
    short: "Centre",
    icon: Building2,
    home: "/admin/centre",
    groups: [
      {
        label: "Pilotage",
        items: [item("/admin/centre", "Tableau de bord", LayoutDashboard, "centre.dashboard")],
      },
      {
        label: "Apprenants",
        items: [
          item("/admin/registrations", "Inscrits", Users, "centre.registrations", { badge: "registrations" }),
          item("/admin/contacts", "Contacts", Mail, "centre.contacts", { badge: "contacts" }),
          item("/admin/assessments", "Skill Assessment", ClipboardCheck, "centre.assessments"),
        ],
      },
      {
        label: "Contenu du site",
        items: [
          item("/admin/slides", "Accueil", House, "centre.slides"),
          item("/admin/courses", "Courses", BookOpen, "centre.courses"),
          item("/admin/competences", "Compétences", GraduationCap, "centre.competences"),
          item("/admin/blog", "Blog", Newspaper, "centre.blog"),
          item("/admin/informations", "Informations", Info, "centre.informations"),
          item("/admin/certifications", "Certifications", Award, "centre.certifications"),
          item("/admin/businesses", "Businesses", Building2, "centre.businesses"),
          item("/admin/partners", "Partenaires", Handshake, "centre.partners"),
        ],
      },
    ],
  },
  {
    id: "rh",
    label: "Ressources humaines",
    short: "RH",
    icon: Users,
    home: "/admin/rh",
    groups: [
      { label: "Pilotage", items: [item("/admin/rh", "Tableau de bord", LayoutDashboard, "rh.dashboard")] },
      {
        label: "Personnel",
        items: [
          item("/admin/rh/enseignants", "Enseignants", GraduationCap, "rh.teachers"),
          item("/admin/rh/employes", "Employés", UserRound, "rh.employees"),
          item("/admin/rh/contrats", "Contrats et documents", FileSignature, "rh.contracts"),
        ],
      },
      {
        label: "Organisation",
        items: [
          item("/admin/rh/planning", "Plannings et affectations", CalendarDays, "rh.planning"),
          item("/admin/rh/presences", "Présences et heures", CalendarCheck, "rh.attendance", { badge: "attendance" }),
          item("/admin/rh/conges", "Congés et absences", CalendarX, "rh.leaves", { badge: "leaves" }),
        ],
      },
      {
        label: "Paie",
        items: [
          item("/admin/rh/tarifs", "Tarifs horaires et salaires", Coins, "rh.rates"),
          item("/admin/rh/paie", "Calcul des rémunérations", Calculator, "rh.payroll"),
          item("/admin/rh/ajustements", "Primes, avances et retenues", HandCoins, "rh.adjustments", { badge: "adjustments" }),
          item("/admin/rh/bulletins", "Bulletins de paie", FileText, "rh.payroll"),
        ],
      },
      {
        label: "Analyse",
        items: [
          item("/admin/rh/rapports", "Rapports RH", BarChart3, "rh.reports"),
          item("/admin/rh/parametres", "Paramètres RH", Settings, "rh.settings"),
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "Finances",
    short: "Finance",
    icon: Wallet,
    home: "/admin/finance",
    groups: [
      {
        label: "Pilotage",
        items: [item("/admin/finance", "Tableau de bord", LayoutDashboard, "finance.dashboard")],
      },
      {
        label: "Frais de formation",
        items: [
          item("/admin/finance/tarifs", "Frais des formations", Tags, "finance.fees"),
          item("/admin/finance/remises", "Remises et réductions", BadgePercent, "finance.discounts"),
        ],
      },
      {
        label: "Students et encaissements",
        items: [
          item("/admin/finance/eleves", "Liste des students", Users, "finance.students"),
          item("/admin/finance/encaissements", "Encaissements", CircleDollarSign, "finance.payments"),
          item("/admin/finance/impayes", "Mensualités et impayés", ListChecks, "finance.schedules"),
          item("/admin/finance/echeanciers", "Échéanciers personnalisés", CalendarClock, "finance.schedules"),
          item("/admin/finance/factures", "Factures et reçus", ReceiptText, "finance.invoices"),
        ],
      },
      {
        label: "Paiements du personnel",
        items: [
          item("/admin/finance/salaires", "Salaires des employés", Banknote, "finance.staffPayments", { badge: "staffPayments" }),
          item("/admin/finance/remunerations", "Rémunérations des enseignants", GraduationCap, "finance.staffPayments"),
          item("/admin/finance/avances", "Avances et soldes à payer", HandCoins, "finance.advances", { badge: "advances" }),
        ],
      },
      {
        label: "Dépenses du centre",
        items: [
          item("/admin/finance/depenses/nouvelle", "Nouvelle dépense", SquarePen, "finance.expenses", { action: "create" }),
          item("/admin/finance/depenses", "Dépenses enregistrées", CreditCard, "finance.expenses", { badge: "expenses" }),
          item("/admin/finance/categories", "Catégories et justificatifs", FolderOpen, "finance.expenseCategories"),
        ],
      },
      {
        label: "Caisse et comptes",
        items: [
          item("/admin/finance/comptes/cash", "Espèces", PiggyBank, "finance.accounts"),
          item("/admin/finance/comptes/bank", "Comptes bancaires", Landmark, "finance.accounts"),
          item("/admin/finance/comptes/dmoney", "D-Money", Smartphone, "finance.accounts"),
          item("/admin/finance/comptes/waafi", "Waafi", Smartphone, "finance.accounts"),
          item("/admin/finance/comptes/cacpay", "CAC Pay", WalletCards, "finance.accounts"),
          item("/admin/finance/comptes/sabapay", "Saba Pay", WalletCards, "finance.accounts"),
          item("/admin/finance/transferts", "Transferts entre comptes", Repeat, "finance.transfers"),
        ],
      },
      {
        label: "Analyse",
        items: [
          item("/admin/finance/rapports", "Rapports financiers", BarChart3, "finance.reports"),
          item("/admin/finance/parametres", "Paramètres financiers", Settings, "finance.settings"),
        ],
      },
    ],
  },
  {
    id: "eleves",
    label: "Espace students (application)",
    short: "Students",
    icon: School,
    home: "/admin/eleves",
    groups: [
      {
        label: "Application mobile",
        items: [item("/admin/eleves", "Accès à l’application", KeyRound, "eleves.access")],
      },
      {
        label: "Suivi pédagogique",
        items: [
          item("/admin/eleves/cours", "Cours et documents", BookOpen, "eleves.lessons"),
          item("/admin/eleves/presences", "Présences des students", CalendarCheck, "eleves.attendance"),
          item("/admin/eleves/notes", "Notes et évaluations", Award, "eleves.grades"),
          item("/admin/eleves/annonces", "Annonces aux students", Megaphone, "eleves.announcements"),
        ],
      },
    ],
  },
];

const allowed = (admin, entry) =>
  !entry.section ? admin.superAdmin : admin.can(entry.section, entry.action || "view");
export function visibleModules(admin) {
  return MODULE_MENUS.filter((module) => (module.superAdmin ? admin.superAdmin : admin.canModule(module.id)))
    .map((module) => ({
      ...module,
      groups: module.groups
        .map((group) => ({ ...group, items: group.items.filter((entry) => allowed(admin, entry)) }))
        .filter((group) => group.items.length),
    }))
    .filter((module) => module.groups.length);
}
const prefix = (path) =>
  path.startsWith("/admin/rh")
    ? "rh"
    : path.startsWith("/admin/finance")
      ? "finance"
      : path.startsWith("/admin/eleves")
        ? "eleves"
      : path === "/admin" || path.startsWith("/admin/systeme")
        ? "system"
        : path === "/admin/security"
          ? null
          : "centre";
export const moduleOf = (path) => prefix(path);
// L’entrée de menu la plus précise pour l’adresse affichée.
export function findEntry(modules, path) {
  let best = null;
  for (const module of modules)
    for (const group of module.groups)
      for (const entry of group.items)
        if (path === entry.path || path.startsWith(`${entry.path}/`))
          if (!best || entry.path.length > best.entry.path.length) best = { module, group, entry };
  return best;
}
export const firstPath = (modules) => modules[0]?.groups[0]?.items[0]?.path || "/admin/security";
