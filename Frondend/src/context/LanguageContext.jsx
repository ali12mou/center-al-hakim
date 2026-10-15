import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { translateText } from '../../../Backend/data/languages.js';

const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => { try { const saved = localStorage.getItem('alhakim-language'); return ['fr', 'en', 'ar'].includes(saved) ? saved : 'fr'; } catch { return 'fr'; } });
  const { pathname } = useLocation();
  useEffect(() => { const admin = pathname.startsWith('/admin'); document.documentElement.lang = admin ? 'fr' : language; document.documentElement.dir = !admin && language === 'ar' ? 'rtl' : 'ltr'; try { localStorage.setItem('alhakim-language', language); } catch {} }, [language, pathname]);
  return <LanguageContext.Provider value={{ language, setLanguage, t: value => translateText(value, language) }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
