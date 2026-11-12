import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'alhakim-theme';
const validTheme = value => value === 'light' || value === 'dark';

function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return validTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  // Sans choix explicite, suivre le réglage de l’appareil.
  const [preference, setPreference] = useState(savedTheme);
  const [system, setSystem] = useState(systemTheme);
  const theme = preference || system;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = event => setSystem(event.matches ? 'dark' : 'light');
    const sync = event => {
      if (event.key === STORAGE_KEY || event.key === null) setPreference(savedTheme());
    };
    media.addEventListener('change', change);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', change);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1728' : '#193964');
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
