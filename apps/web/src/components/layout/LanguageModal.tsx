import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@richpath/shared';
import { Modal } from '../ui/index.js';
import { applyDirection } from '../../i18n/index.js';

/** Endonyms so each option reads correctly regardless of current locale. */
const LABELS: Record<Locale, string> = {
  en: 'English', ru: 'Русский', pt: 'Português', es: 'Español', de: 'Deutsch',
  fr: 'Français', tr: 'Türkçe', ar: 'العربية', vi: 'Tiếng Việt', ja: '日本語',
  bn: 'বাংলা', hi: 'हिंदी', id: 'Indonesia', ur: 'اردو', sw: 'Swahili',
  uk: 'Українська', fil: 'Filipino', ms: 'Bahasa Melayu', ko: '한국어', fa: 'فارسی',
};

/** Locales that actually ship translations in this build. */
const TRANSLATED = new Set(['en', 'es', 'fr', 'de', 'pt', 'ru', 'ar']);

export function LanguageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { i18n, t } = useTranslation();

  const choose = (locale: Locale) => {
    void i18n.changeLanguage(locale);
    applyDirection(locale);
    localStorage.setItem('rp_locale', locale);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('nav.language')}>
      <div className="grid max-h-[60vh] grid-cols-2 gap-1 overflow-y-auto">
        {LOCALES.map((locale) => {
          const isActive = i18n.resolvedLanguage === locale;
          const available = TRANSLATED.has(locale);
          return (
            <button
              key={locale}
              onClick={() => choose(locale)}
              aria-current={isActive}
              className={
                'flex items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm transition ' +
                (isActive ? 'bg-brand-500/15 text-brand-400' : 'text-slate-200 hover:bg-white/5')
              }
            >
              <span dir={locale === 'ar' || locale === 'ur' || locale === 'fa' ? 'rtl' : 'ltr'}>{LABELS[locale]}</span>
              {!available && <span className="text-[10px] uppercase tracking-wide text-slate-500">soon</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Translating into 20 languages needs a translation service or a proper i18n workflow — this demo ships
        English plus six community translations.
      </p>
    </Modal>
  );
}
