// Catalogue des droits, partagé : le Backend l’impose, l’administration
// l’affiche (cases à cocher) et masque ce que l’utilisateur ne peut pas faire.
// Une permission s’écrit « section:action », par exemple « rh.teachers:create ».
export const ACTIONS = {
  view: "Consulter",
  create: "Ajouter",
  update: "Modifier",
  delete: "Supprimer",
  approve: "Valider",
};
const crud = ["view", "create", "update", "delete"];
const section = (id, label, actions = crud, hint = "") => ({
  id,
  label,
  actions,
  hint,
});

export const MODULES = [
  {
    id: "centre",
    label: "Gestion du centre",
    short: "Centre",
    sections: [
      section("centre.dashboard", "Tableau de bord du centre", ["view"]),
      section("centre.registrations", "Inscriptions", ["view", "create", "update"]),
      section("centre.contacts", "Contacts", ["view", "create", "update"]),
      section("centre.assessments", "Skill Assessment et résultats"),
      section("centre.marketingAgents", "Agents marketing"),
      section("centre.prospects", "Collecte des prospects"),
      section("centre.slides", "Accueil (diaporama)"),
      section("centre.courses", "Formations (Courses)"),
      section("centre.competences", "Compétences"),
      section("centre.blog", "Blog"),
      section("centre.informations", "Informations"),
      section("centre.certifications", "Certifications"),
      section("centre.businesses", "Businesses"),
      section("centre.partners", "Partenaires"),
    ],
  },
  {
    id: "rh",
    label: "Ressources humaines",
    short: "RH",
    sections: [
      section("rh.dashboard", "Tableau de bord RH", ["view"]),
      section("rh.teachers", "Enseignants"),
      section("rh.employees", "Employés"),
      section("rh.contracts", "Contrats et documents"),
      section("rh.planning", "Plannings et affectations"),
      section(
        "rh.attendance",
        "Présences et heures travaillées",
        [...crud, "approve"],
        "Valider : confirmer les heures prises en compte dans la paie.",
      ),
      section(
        "rh.leaves",
        "Congés et absences",
        [...crud, "approve"],
        "Valider : accepter ou refuser une demande.",
      ),
      section("rh.rates", "Tarifs horaires et salaires", ["view", "update"]),
      section(
        "rh.payroll",
        "Calcul des rémunérations et bulletins",
        [...crud, "approve"],
        "Valider : figer un bulletin avant son paiement.",
      ),
      section(
        "rh.adjustments",
        "Primes, avances et retenues",
        [...crud, "approve"],
        "Valider : accorder une prime, une avance ou une retenue.",
      ),
      section("rh.reports", "Rapports RH", ["view"]),
      section("rh.settings", "Paramètres RH", ["view", "update"]),
    ],
  },
  {
    id: "finance",
    label: "Finances",
    short: "Finance",
    sections: [
      section("finance.dashboard", "Tableau de bord financier", ["view"]),
      section("finance.fees", "Frais des formations"),
      section(
        "finance.students",
        "Liste des students",
        crud,
        "Fiches students (photo, formation, contact, accès) et situation de paiement.",
      ),
      section("finance.discounts", "Remises et réductions"),
      section(
        "finance.schedules",
        "Dossiers financiers et échéanciers",
        crud,
        "Dossier de chaque student : montant, échéancier, solde.",
      ),
      section(
        "finance.payments",
        "Paiements des students",
        crud,
        "Supprimer : annuler un paiement (avec motif, historique conservé).",
      ),
      section(
        "finance.invoices",
        "Factures et reçus",
        crud,
        "Supprimer : annuler une facture (avec motif).",
      ),
      section(
        "finance.staffPayments",
        "Paiements du personnel",
        [...crud, "approve"],
        "Valider : accord de la direction avant décaissement.",
      ),
      section(
        "finance.advances",
        "Avances et soldes à payer",
        ["view", "create", "approve"],
        "Valider : verser une avance accordée.",
      ),
      section(
        "finance.expenses",
        "Dépenses du centre",
        [...crud, "approve"],
        "Valider : approuver une dépense au-dessus du seuil.",
      ),
      section("finance.expenseCategories", "Catégories de dépenses"),
      section("finance.accounts", "Caisse et comptes"),
      section("finance.transfers", "Transferts entre comptes", [
        "view",
        "create",
        "delete",
      ]),
      section("finance.reports", "Rapports financiers", ["view"]),
      section("finance.settings", "Paramètres financiers", ["view", "update"]),
    ],
  },
  {
    id: "eleves",
    label: "Espace students (application)",
    short: "Students",
    sections: [
      section(
        "eleves.access",
        "Accès à l’application",
        crud,
        "Créer les identifiants des students et réinitialiser leurs mots de passe.",
      ),
      section("eleves.lessons", "Cours et documents"),
      section("eleves.attendance", "Présences des students"),
      section("eleves.grades", "Notes et évaluations"),
      section("eleves.announcements", "Annonces aux students"),
    ],
  },
];

export const ROLES = {
  admin: "Administrateur général",
  staff: "Utilisateur",
};
export const SECTIONS = Object.fromEntries(
  MODULES.flatMap((module) =>
    module.sections.map((item) => [item.id, { ...item, module: module.id }]),
  ),
);

export const isSuperAdmin = (user) => user?.role === "admin";
export function can(user, sectionId, action = "view") {
  if (!user || user.active === false) return false;
  if (isSuperAdmin(user)) return true;
  return (user.permissions || []).includes(`${sectionId}:${action}`);
}
// Au moins une section du module est consultable.
export const canModule = (user, moduleId) =>
  isSuperAdmin(user) ||
  (MODULES.find((module) => module.id === moduleId)?.sections || []).some(
    (item) => can(user, item.id, "view"),
  );
// Ajouter, modifier, supprimer ou valider suppose de pouvoir consulter.
export function cleanPermissions(list = []) {
  const result = new Set();
  for (const value of Array.isArray(list) ? list : []) {
    if (typeof value !== "string") continue;
    const [sectionId, action] = value.split(":");
    if (!Object.hasOwn(SECTIONS, sectionId)) continue;
    if (!SECTIONS[sectionId].actions.includes(action)) continue;
    result.add(`${sectionId}:${action}`);
    result.add(`${sectionId}:view`);
  }
  return [...result].sort();
}
