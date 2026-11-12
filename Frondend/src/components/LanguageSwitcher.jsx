import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const LANGUAGES = [['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']];

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-switch" role="group" aria-label={t('Langue du site')}>
      <Languages size={16} aria-hidden="true" />
      {LANGUAGES.map(([code, label]) => (
        <button
          type="button"
          key={code}
          lang={code}
          aria-label={label}
          title={label}
          aria-pressed={language === code}
          className={language === code ? 'selected' : ''}
          onClick={() => setLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
