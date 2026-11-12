// Espace élève installable (PWA) : le manifeste et le service worker ne sont
// déclarés que sous /etudiant. Le site public et l’administration ne
// s’installent donc pas comme application.
(() => {
  if (!location.pathname.startsWith("/etudiant")) return;
  const add = (tag, attributes) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    document.head.appendChild(element);
  };
  add("link", { rel: "manifest", href: "/manifest.webmanifest" });
  add("link", { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" });
  add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  add("meta", { name: "mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-title", content: "AL-HAKIM" });
  add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" });
  document.title = "AL-HAKIM CENTER · Espace élève";
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/student-sw.js", { scope: "/etudiant" }).catch(() => {});
    });
})();
