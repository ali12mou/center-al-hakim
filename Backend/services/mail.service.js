import nodemailer from "nodemailer";

// Envoi d’e-mails par SMTP (Gmail, Outlook, hébergeur…), configuré dans Backend/.env.
// Un identifiant sans mot de passe compte comme « non configuré ».
export const mailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_FROM &&
      (!process.env.SMTP_USER || process.env.SMTP_PASSWORD),
  );

let transport;
function getTransport() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        }
      : {}),
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  return transport;
}

export const sendMail = (message) =>
  getTransport().sendMail({ from: process.env.SMTP_FROM, ...message });

const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

const dateLabel = (date) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Djibouti",
  }).format(date);

// Message d’information envoyé à chaque connexion à l’administration.
export function otpEmail({ name, code, minutes, ip, device, at = new Date() }) {
  const when = dateLabel(at);
  const subject = `${code} — Code de connexion AL-HAKIM CENTER`;
  const text = [
    `Bonjour ${name},`,
    "",
    "Une connexion à l’espace administration AL-HAKIM CENTER vient d’être demandée.",
    "",
    `Votre code de vérification : ${code}`,
    `Il est valable ${minutes} minutes et ne peut servir qu’une seule fois.`,
    "",
    "Détails de la demande :",
    `- Date : ${when}`,
    `- Adresse IP : ${ip || "inconnue"}`,
    `- Appareil : ${device || "inconnu"}`,
    "",
    "Si vous n’êtes pas à l’origine de cette demande, ne communiquez ce code à personne",
    "et changez immédiatement votre mot de passe.",
    "",
    "AL-HAKIM CENTER — Learn Today. Lead Tomorrow.",
  ].join("\n");
  const digits = code
    .split("")
    .map(
      (digit) =>
        `<td style="width:46px;height:56px;background:#ffffff;border:1px solid #dbe3f0;border-radius:10px;font:700 28px/56px 'Segoe UI',Arial,sans-serif;color:#0d2241;text-align:center">${digit}</td><td style="width:8px"></td>`,
    )
    .join("");
  const row = (label, value) =>
    `<tr><td style="padding:6px 0;color:#66768c;font-size:13px;width:120px">${label}</td><td style="padding:6px 0;color:#142a4a;font-size:13px;font-weight:600">${escapeHtml(value)}</td></tr>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#eef2f8;font-family:'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(13,34,65,.12)">
<tr><td style="background:linear-gradient(135deg,#0d2241 0%,#193964 60%,#d71850 140%);background-color:#0d2241;padding:28px 32px">
<div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.6px">AL-HAKIM CENTER</div>
<div style="color:#b9c8e0;font-size:13px;margin-top:4px">Espace administration · Vérification de connexion</div>
</td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 6px;color:#142a4a;font-size:17px;font-weight:700">Bonjour ${escapeHtml(name)},</p>
<p style="margin:0 0 24px;color:#44566f;font-size:14px;line-height:1.6">Une connexion à votre compte administrateur vient d’être demandée. Saisissez ce code pour la confirmer :</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px"><tr>${digits}</tr></table>
<p style="margin:0 0 26px;text-align:center;color:#d71850;font-size:13px;font-weight:600">Valable ${minutes} minutes · usage unique</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;border-radius:12px;padding:14px 18px">
${row("Date", when)}${row("Adresse IP", ip || "inconnue")}${row("Appareil", device || "inconnu")}
</table>
<p style="margin:22px 0 0;padding:14px 16px;background:#fdebf1;border-radius:10px;color:#8f1238;font-size:13px;line-height:1.55"><strong>Ce n’est pas vous ?</strong> Ne communiquez ce code à personne et changez immédiatement votre mot de passe. L’équipe AL-HAKIM CENTER ne vous demandera jamais ce code.</p>
</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #eef1f6;color:#8a98ab;font-size:12px;text-align:center">AL-HAKIM CENTER — Learn Today. Lead Tomorrow.<br>Message automatique, merci de ne pas y répondre.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
