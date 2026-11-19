import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { verifySmtp, sendMail } from "../services/mail.service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });
try {
  await verifySmtp();
  if (process.argv.includes("--send-test")) {
    if (!process.env.SMTP_USER?.trim()) throw new Error("SMTP_USER est nécessaire pour recevoir le message de test.");
    const result = await sendMail({
      to: process.env.SMTP_USER.trim(),
      subject: "AL-HAKIM CENTER — Test de livraison SMTP",
      text: "Le serveur SMTP fonctionne. Ce message est un test technique, sans code de connexion. Vous pouvez maintenant demander un nouveau code OTP depuis le site.",
    });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("Le destinataire du test a été refusé par SMTP.");
    console.log("Message de test accepté par SMTP pour la boîte SMTP_USER. Vérifiez la boîte de réception et les indésirables.");
  }
  console.log("SMTP OK : connexion, TLS et authentification vérifiés. Aucun e-mail envoyé.");
  console.log("Connectez-vous ensuite à l’administration pour vérifier la réception du code OTP.");
} catch (error) {
  const hints = {
    EAUTH: "Authentification refusée : vérifiez SMTP_USER et SMTP_PASSWORD auprès du fournisseur.",
    EDNS: "Hôte SMTP introuvable : vérifiez SMTP_HOST et le DNS du serveur.",
    ETIMEDOUT: "Délai dépassé : vérifiez le port SMTP et les restrictions réseau de l’hébergeur.",
    ECONNECTION: "Connexion SMTP impossible : vérifiez l’hôte, le port et le pare-feu.",
    ESOCKET: "Erreur de connexion/TLS : vérifiez le certificat et le couple SMTP_PORT / SMTP_SECURE.",
    ETLS: "Échec STARTTLS : vérifiez la configuration TLS du fournisseur.",
  };
  // Do not print raw SMTP responses, credentials or OTPs.
  console.error(hints[error.code] || (error.code ? "Échec SMTP : vérifiez la configuration et le certificat du fournisseur." : error.message));
  process.exitCode = 1;
}
