import {
  LayoutDashboard,
  GraduationCap,
  Info,
  Users,
  Newspaper,
  BookOpen,
  ClipboardCheck,
  Building2,
  Award,
  Mail,
  Handshake,
  ShieldCheck,
} from "lucide-react";

// `badge` renvoie au compteur correspondant de /api/admin/badges.
export const menuGroups = [
  {
    label: "Pilotage",
    items: [
      { path: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
    ],
  },
  {
    label: "Apprenants",
    items: [
      {
        path: "/admin/registrations",
        label: "Inscrits",
        icon: Users,
        badge: "registrations",
      },
      {
        path: "/admin/contacts",
        label: "Contacts",
        icon: Mail,
        badge: "contacts",
      },
      {
        path: "/admin/assessments",
        label: "Skill Assessment",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Contenu du site",
    items: [
      { path: "/admin/courses", label: "Courses", icon: BookOpen },
      { path: "/admin/competences", label: "Compétences", icon: GraduationCap },
      { path: "/admin/blog", label: "Blog", icon: Newspaper },
      { path: "/admin/informations", label: "Informations", icon: Info },
      { path: "/admin/certifications", label: "Certifications", icon: Award },
      { path: "/admin/businesses", label: "Businesses", icon: Building2 },
      { path: "/admin/partners", label: "Partenaires", icon: Handshake },
    ],
  },
  {
    label: "Compte",
    items: [
      { path: "/admin/security", label: "Sécurité", icon: ShieldCheck },
    ],
  },
];
export const menu = menuGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);
const field = (key, label, type = "text", options = {}) => ({
  key,
  label,
  type,
  ...options,
});
const common = [
  field("title", "Titre", "text", { required: true }),
  field("description", "Description courte", "textarea"),
  field("body", "Contenu", "textarea"),
  field("imageUrl", "Image", "image"),
  field("published", "Publier sur le site", "checkbox"),
];
const departments = [
  ["langues", "Langues"],
  ["management", "Management & affaires"],
  ["informatique", "Informatique"],
  ["finance", "Comptabilité & finance"],
];
const person = [
  field("name", "Nom complet", "text", { required: true }),
  field("phone", "Téléphone", "tel", { required: true }),
  field("email", "Adresse e-mail", "email", { required: true }),
  field("courseId", "Formation / compétence", "course"),
  field("schedule", "Disponibilité", "select", {
    options: [
      ["flexible", "À définir"],
      ["matin", "Matin"],
      ["soir", "Soir"],
      ["week-end", "Week-end"],
    ],
  }),
  field("message", "Message", "textarea"),
  field("status", "Statut", "select", {
    options: [
      ["new", "Nouveau"],
      ["contacted", "Contacté"],
      ["confirmed", "Confirmé"],
      ["closed", "Clôturé"],
    ],
  }),
];
export const sections = {
  competences: {
    title: "Compétences",
    description:
      "Présentez les compétences enseignées et publiez-les sur le site.",
    publicPath: "/competences",
    fields: [
      common[0],
      field("category", "Domaine", "select", { options: departments }),
      ...common.slice(1),
    ],
  },
  informations: {
    title: "Informations",
    description: "Publiez les annonces et informations utiles du centre.",
    publicPath: "/informations",
    fields: [common[0], field("category", "Catégorie"), ...common.slice(1)],
  },
  blog: {
    title: "Blog",
    description: "Rédigez et publiez les articles du centre.",
    publicPath: "/blog",
    fields: [
      common[0],
      field("category", "Catégorie"),
      field("author", "Auteur"),
      ...common.slice(1),
    ],
  },
  businesses: {
    title: "Businesses",
    description: "Gérez les offres de formation pour les organisations.",
    publicPath: "/businesses",
    fields: [
      common[0],
      field("audience", "Public concerné"),
      field("benefits", "Bénéfices (un par ligne)", "lines"),
      ...common.slice(1),
    ],
  },
  certifications: {
    title: "Certifications",
    description:
      "Précisez les attestations, conditions et organismes émetteurs.",
    publicPath: "/certifications",
    fields: [
      common[0],
      field("issuer", "Organisme émetteur"),
      field("requirements", "Conditions (une par ligne)", "lines"),
      field("accreditation", "Reconnaissance / modalités"),
      ...common.slice(1),
    ],
  },
  assessments: {
    title: "Skill Assessment",
    description: "Créez des évaluations avec des questions et leurs réponses.",
    publicPath: "/skill-assessment",
    fields: [
      common[0],
      field("skill", "Compétence évaluée"),
      ...common.slice(1),
      field("questions", "Questions", "questions"),
    ],
  },
  partners: {
    title: "Partenaires",
    description:
      "Présentez les partenaires et les outils de votre écosystème avec leur statut.",
    publicPath: "/#partenaires",
    fields: [
      common[0],
      field("website", "Site internet"),
      field("relationship", "Statut de la relation", "select", {
        options: [
          ["pending", "Collaboration à confirmer"],
          ["ecosystem", "Écosystème technologique"],
          ["partner", "Partenaire confirmé"],
        ],
      }),
      ...common.slice(1),
    ],
  },
  courses: {
    title: "Courses",
    description: "Gérez les formations, programmes, niveaux et publications.",
    publicPath: "/courses",
    fields: [
      field("id", "Identifiant de la formation", "text", {
        required: true,
        hint: "Lettres minuscules, chiffres et tirets. Exemple : anglais-professionnel.",
      }),
      field("title", "Nom de la formation", "text", { required: true }),
      field("department", "Département", "select", { options: departments }),
      field("description", "Description", "textarea"),
      field("topics", "Programme (un point par ligne)", "lines"),
      field("level", "Niveau"),
      field("duration", "Durée"),
      field("format", "Format"),
      field("image", "Illustration", "select", { options: departments }),
      field("tag", "Étiquette"),
      field("phase", "Disponibilité / phase"),
      field("featured", "Mettre en avant", "checkbox"),
      field("published", "Publier sur le site", "checkbox"),
    ],
  },
  registrations: {
    title: "Inscrits",
    description:
      "Suivez les demandes de formation et les profils des apprenants.",
    person: true,
    fields: [
      ...person,
      field("username", "Nom d’utilisateur"),
      field("password", "Nouveau mot de passe", "password", {
        hint: "Au moins 12 caractères. Laissez vide pour conserver le mot de passe existant.",
      }),
      field("profile", "Profil", "select", {
        options: [
          ["apprenant", "Apprenant"],
          ["professionnel", "Professionnel"],
          ["entreprise", "Entreprise"],
        ],
      }),
    ],
  },
  contacts: {
    title: "Contacts",
    description: "Consultez et traitez les messages adressés au centre.",
    person: true,
    fields: [
      ...person,
      field("kind", "Type de demande", "select", {
        options: [
          ["contact", "Renseignements"],
          ["enterprise", "Entreprise"],
        ],
      }),
    ],
  },
};
export const statusLabels = {
  new: "Nouveau",
  contacted: "Contacté",
  confirmed: "Confirmé",
  closed: "Clôturé",
};
export const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Nairobi",
      }).format(new Date(value))
    : "—";
export const dateTimeLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Nairobi",
      }).format(new Date(value))
    : "—";
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "A";
