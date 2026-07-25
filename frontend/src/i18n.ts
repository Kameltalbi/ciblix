import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import frTranslation from './locales/fr.json';
import arTranslation from './locales/ar.json';
import enTranslation from './locales/en.json';

const resources = {
  fr: {
    translation: frTranslation,
  },
  ar: {
    translation: arTranslation,
  },
  en: {
    translation: enTranslation,
  },
};

function normalizeStoredLng(): string {
  const raw = localStorage.getItem('i18nextLng') || 'fr';
  const base = raw.split('-')[0]?.toLowerCase() || 'fr';
  return ['fr', 'en', 'ar'].includes(base) ? base : 'fr';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['fr', 'en', 'ar'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'fr',
    lng: normalizeStoredLng(),
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      convertDetectedLanguage: (lng) => {
        const base = (lng || 'fr').split('-')[0]?.toLowerCase() || 'fr';
        return ['fr', 'en', 'ar'].includes(base) ? base : 'fr';
      },
    },
  });

i18n.on('languageChanged', (lng) => {
  const base = (lng || 'fr').split('-')[0] || 'fr';
  document.documentElement.lang = base;
  document.documentElement.dir = base === 'ar' ? 'rtl' : 'ltr';
});

export default i18n;
