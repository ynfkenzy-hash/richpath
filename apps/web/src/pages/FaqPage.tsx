import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui/index.js';
import { FAQ_ITEMS } from '../content/faq.js';


export function FaqPage() {
  const { t } = useTranslation();
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL ?? 'Richard23@gmail.com';
  const items = FAQ_ITEMS.map((item) => ({ ...item, a: item.a.replaceAll('{{support}}', supportEmail) }));
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <Link to="/user" className="text-sm text-brand-400 hover:underline">
        ← {t('common.back')}
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{t('legal.faqTitle')}</h1>
        <p className="text-sm text-slate-400">
          Every answer below states its limits. If an answer here does not match what the app actually does, treat
          that as a bug worth reporting.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.q} className="p-0">
            <details className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-medium">
                <span className="flex-1">{item.q}</span>
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M5 8l5 5 5-5" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="mt-2 text-sm text-slate-400">{item.a}</p>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}
