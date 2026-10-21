// Mesure d’audience Google Analytics 4 (balise Google « gtag.js »).
// Fichier séparé plutôt que script dans la page : la politique de sécurité
// (CSP) du serveur n’autorise que les scripts chargés depuis un fichier.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
window.gtag = gtag;
// L’administration n’est pas mesurée : seules les pages publiques comptent.
if (location.pathname.startsWith("/admin"))
  window["ga-disable-G-DDH98S5HEG"] = true;
gtag("js", new Date());
gtag("config", "G-DDH98S5HEG");
