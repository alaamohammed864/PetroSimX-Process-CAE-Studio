export type Language = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export interface I18nContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}
