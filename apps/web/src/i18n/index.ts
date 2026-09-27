import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { RTL_LOCALES, type Locale } from '@richpath/shared';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';

export const resources = { en: { translation: en }, es: { translation: es }, fr: { translation: fr }, de: { translation: de }, pt: { translation: pt }, ru: { translation: ru }, ar: { translation: ar } };

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: Object.keys(resources),
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'rp_locale' },
  });

export function applyDirection(locale: string) {
  const dir = RTL_LOCALES.includes(locale as Locale) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', locale);
}

export default i18n;
