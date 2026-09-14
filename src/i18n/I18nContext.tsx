import React, { createContext, useContext, useState, useEffect } from 'react';
import { Direction, I18nContextType, Language } from './types';
import { TRANSLATIONS } from './translations';

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  direction: 'ltr',
  setLanguage: () => {},
  t: (k: string) => k,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('petrosimx_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'en';
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem('petrosimx_lang', language);
    } catch {
      // ignore
    }
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    if (dict[key]) return dict[key];
    if (TRANSLATIONS.en[key]) return TRANSLATIONS.en[key];
    return fallback || key;
  };

  return (
    <I18nContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
