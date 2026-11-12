import { Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ThemeToggle({ showLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const label = value => pathname.startsWith('/admin') ? value : t(value);
  const dark = theme === 'dark';
  const action = label(dark ? 'Activer le mode jour' : 'Activer le mode nuit');
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={action}
      title={action}
      aria-pressed={dark}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      {showLabel && <span>{label(dark ? 'Mode nuit' : 'Mode jour')}</span>}
    </button>
  );
}
