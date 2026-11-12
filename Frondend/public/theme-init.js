// Appliquer la préférence avant le premier affichage pour éviter un flash clair.
(() => {
  let theme;
  try {
    theme = localStorage.getItem('alhakim-theme');
  } catch {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
