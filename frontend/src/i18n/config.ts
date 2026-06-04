import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en/translation.json';
import boTranslations from './locales/bo/translation.json';
import zhTranslations from './locales/zh/translation.json';

i18n
  .use(LanguageDetector) // Detects user language
  .use(initReactI18next) // Passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      bo: {
        translation: boTranslations,
      },
      zh:{
        translation: zhTranslations,
      }
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes values
      alwaysFormat: true,
      format: (value, _format, lng) => {
        if (typeof value !== 'number') return value;
        if (lng === 'bo') return value.toString().replace(/\d/g, (d) => '༠༡༢༣༤༥༦༧༨༩'[Number(d)]);
        return value;
      },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

