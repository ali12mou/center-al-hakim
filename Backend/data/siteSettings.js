import { centre, departments } from "./catalogue.js";
export const footerDefaults = {
  ctaTitle: "Votre prochaine étape commence ici.", ctaDescription: "Développez vos compétences en langues, informatique, comptabilité et management avec AL-HAKIM CENTER.",
  primaryLabel: "Me préinscrire", primaryUrl: "/inscription", secondaryLabel: "Découvrir les formations", secondaryUrl: "/formations",
  introduction: "Des compétences pour aujourd’hui. Des perspectives pour demain.", description: "AL-HAKIM CENTER accompagne les jeunes, les étudiants et les professionnels à Djibouti dans le développement de leurs compétences linguistiques, numériques et professionnelles.",
  motto: "Apprendre · Se former · Réussir", discoverTitle: "Découvrir le centre", domainsTitle: "Domaines de formation", contactTitle: "Nous contacter",
  whatsappLabel: "Échanger avec notre équipe", mapLabel: "Nous trouver", logoUrl: "/Untitled-2.png", legalLabel: "Mentions légales", privacyLabel: "Confidentialité", termsLabel: "Conditions d’inscription", termsUrl: "", backToTopLabel: "Retour en haut", copyright: "Tous droits réservés.",
  links: [{label:"Présentation",url:"/centre"},{label:"Formations",url:"/formations"},{label:"Actualités",url:"/blog"},{label:"Informations",url:"/informations"},{label:"Préinscription",url:"/inscription"}],
  domains: departments.map(item=>({label:item.name,url:`/formations?pole=${item.id}`})),
};
export const siteDefaults = {name:centre.name,phone:centre.phone,phoneLink:centre.phoneLink,email:centre.email,whatsapp:centre.whatsapp,address:centre.address,landmark:centre.landmark,mapUrl:"",mapEmbedUrl:"",footer:footerDefaults};
