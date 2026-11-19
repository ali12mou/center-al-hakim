import { siteContent } from "./siteContent.js";
const about = siteContent.about;
export const initialPresentations = [
  { title: about.title, accent: about.accent, eyebrow: about.eyebrow, description: about.description,
    body: about.mission, values: about.values, imageUrl: "/images/centre.jpg", buttonLabel: "Faisons connaissance", buttonLink: "/contact", order: 1, published: true },
  { title: "Des compétences pour aujourd’hui.", accent: "Des perspectives pour demain.", eyebrow: "APPRENDRE POUR AVANCER",
    description: "Langues, management, informatique et finance : explorez les parcours du centre et trouvez celui qui correspond à vos objectifs.",
    body: "Vous aider à choisir un parcours utile à votre projet personnel ou professionnel.", values: ["Quatre pôles de formation", "Des programmes à découvrir", "Un échange pour vous orienter"],
    imageUrl: "/images/informatique.jpg", buttonLabel: "Explorer les formations", buttonLink: "/formations", order: 2, published: true },
  { title: "Un projet à construire ?", accent: "Parlons de votre prochaine étape.", eyebrow: "À VOTRE ÉCOUTE",
    description: "Vous souhaitez développer vos compétences ou accompagner votre équipe ? Présentez-nous vos besoins pour échanger avec le centre.",
    body: "Écouter vos objectifs et vous renseigner sur les programmes et leurs modalités.", values: ["Apprenants et professionnels", "Entreprises et organisations", "Un contact direct avec le centre"],
    imageUrl: "/images/management.jpg", buttonLabel: "Présenter mon projet", buttonLink: "/contact", order: 3, published: true },
];
