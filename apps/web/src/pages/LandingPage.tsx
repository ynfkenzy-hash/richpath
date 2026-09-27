import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ActivityEvent } from '@richpath/shared';
import { http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { money, relativeTime } from '../lib/format.js';
import { Badge, Button, Card, Skeleton } from '../components/ui/index.js';
import { FAQ_ITEMS, LANDING_FAQ } from '../content/faq.js';
import { LanguageModal } from '../components/layout/LanguageModal.js';
import { Logo } from '../components/layout/Logo.js';

interface Stats {
  isDemo: boolean;
  registeredUsers: number;
  totalPaid: number;
  countryCount: number;
  note: string;
}

interface Review {
  id: string;
  maskedName: string;
  countryCode: string;
  rating: number;
  body: string;
  verified: boolean;
  isDemo: boolean;
}


export function LandingPage() {
  const { t } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  const stats = useQuery({ queryKey: qk.stats, queryFn: () => http.get<Stats>('/content/stats') });
  const activity = useQuery({
    queryKey: qk.activity,
    queryFn: () => http.get<{ items: ActivityEvent[]; isDemo: boolean }>('/content/activity', { limit: 8 }),
    refetchInterval: Number(import.meta.env.VITE_ACTIVITY_POLL_MS ?? 8000),
  });
  const reviews = useQuery({
    queryKey: qk.reviews,
    queryFn: () => http.get<{ items: Review[]; isDemo: boolean }>('/content/reviews'),
  });

  const nf = new Intl.NumberFormat();
  const latest = activity.data?.items?.[0];

  return (
    <div className="min-h-dvh bg-ink-900">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-extrabold tracking-tight">
          Rich<span className="text-brand-400">Path</span>
        </span>
        <nav className="ms-auto flex items-center gap-1 text-sm">
          <a href="#how" className="hidden rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 sm:block">
            {t('landing.proofTitle')}
          </a>
          <a href="#reviews" className="hidden rounded-lg px-3 py-2 text-slate-300 hover:bg-white/5 sm:block">
            {t('landing.reviewsTitle')}
          </a>
          <button onClick={() => setLangOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label={t('nav.language')}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
            </svg>
          </button>
          <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-brand-400 hover:bg-brand-500/10">
            {t('common.signIn')}
          </Link>
        </nav>
      </header>

      {/* ------------------------------------------------------------- ticker */}
      <div className="border-y border-white/5 bg-ink-800/60">
        <div className="mx-auto flex max-w-5xl items-center gap-3 overflow-hidden px-4 py-2 text-xs text-slate-400">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          {latest ? (
            <p key={latest.id} className="animate-ticker-in truncate">
              {relativeTime(latest.at)} · {t('landing.activityTitle')}: <span className="text-slate-200">{latest.maskedName}</span> ·{' '}
              <span className="font-semibold text-brand-400">{money(latest.amount)}</span>
            </p>
          ) : (
            <Skeleton className="h-3 w-64" />
          )}
          <Badge tone="warning" className="ms-auto hidden shrink-0 sm:inline-flex">
            {t('common.demoData')}
          </Badge>
        </div>
      </div>

      {/* --------------------------------------------------------------- hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-2">
        <div>
          <Badge tone="success">{t('common.demoData')}</Badge>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
            {t('landing.headline')}
          </h1>
          <p className="mt-3 max-w-lg text-slate-300">{t('landing.subhead')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login?mode=register">
              <Button size="lg">{t('landing.cta')}</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                {t('landing.learnMore')}
              </Button>
            </a>
          </div>
          <p className="mt-4 max-w-lg text-xs text-slate-500">{t('landing.disclaimer')}</p>
        </div>

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-slate-200">{t('landing.activityTitle')}</p>
          {activity.isLoading && <Skeleton className="h-24 w-full" />}
          {activity.data && (
            <ul className="space-y-1.5">
              {activity.data.items.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-700/50 px-3 py-2 text-sm"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-xs">
                    {item.countryCode}
                  </span>
                  <span className="truncate text-slate-300">{item.maskedName}</span>
                  <span className="ms-auto font-semibold text-brand-400">{money(item.amount)}</span>
                  <span className="text-xs text-slate-500">{relativeTime(item.at)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">{t('landing.activitySubtitle')}</p>
        </Card>
      </section>

      {/* -------------------------------------------------------------- stats */}
      <section className="mx-auto grid max-w-5xl gap-3 px-4 pb-10 sm:grid-cols-3">
        {[
          { label: t('landing.statsUsers'), value: stats.data ? `${nf.format(stats.data.registeredUsers)}+` : '—' },
          { label: t('landing.statsPaid'), value: stats.data ? money(stats.data.totalPaid) : '—' },
          { label: t('landing.statsCountries'), value: stats.data ? String(stats.data.countryCount) : '—' },
        ].map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-sm text-slate-400">{stat.label}</p>
            </div>
          </Card>
        ))}
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-2">
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100">
          Marketing figures and testimonials in this build are <strong>sample data</strong> from the seed file.
          Publishing invented payout totals or reviews is deceptive advertising — replace them with audited numbers
          and real reviews before going live.
        </p>
      </div>

      {/* ---------------------------------------------------------- how it works */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t('landing.proofTitle')}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { n: '1', t: t('landing.proofStep1'), b: t('landing.proofStep1Body') },
            { n: '2', t: t('landing.proofStep2'), b: t('landing.proofStep2Body') },
            { n: '3', t: t('landing.proofStep3'), b: t('landing.proofStep3Body') },
          ].map((step) => (
            <Card key={step.n} className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 font-bold text-brand-400">
                {step.n}
              </div>
              <p className="font-semibold">{step.t}</p>
              <p className="text-sm text-slate-400">{step.b}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- reviews */}
      <section id="reviews" className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t('landing.reviewsTitle')}</h2>
        <p className="mt-1 text-sm text-amber-200/80">{t('landing.reviewsDemo')}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
          {reviews.data?.items.map((review) => (
            <Card key={review.id} className="flex h-full flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-semibold">
                  {review.maskedName.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{review.maskedName}</p>
                  {review.verified && (
                    <p className="text-[11px] text-brand-400">✓ {t('common.verified')}</p>
                  )}
                </div>
                <span className="ms-auto text-xs text-slate-500">{review.countryCode}</span>
              </div>
              <div className="flex gap-0.5" aria-label={`${review.rating} of 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 20 20"
                    className={'h-4 w-4 ' + (i < review.rating ? 'text-amber-400' : 'text-slate-600')}
                    fill="currentColor"
                  >
                    <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L1.6 7.7l5.8-.8z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-slate-300">{review.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQs */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-bold">{t('landing.faqTitle')}</h2>
        <p className="mt-1 text-sm text-slate-400">
          The questions that decide whether a rewards site can be trusted — answered plainly, including what this
          one will not do.
        </p>
        <div className="mt-6 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-ink-800/60">
          {LANDING_FAQ.map((item, index) => (
            <details key={item.q} className="group px-4 py-3" open={index === 0}>
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
          ))}
        </div>
        <Link
          to="/faq"
          className="mt-4 inline-block text-sm text-brand-400 hover:underline"
        >
          Read all {FAQ_ITEMS.length} questions →
        </Link>
      </section>

      {/* --------------------------------------------------------------- footer */}
      <footer className="border-t border-white/5 bg-ink-800/40">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span className="font-semibold text-slate-200">RichPath</span>
          </div>
          <nav className="flex flex-wrap gap-4 sm:ms-6">
            <Link to="/about" className="hover:text-slate-200">{t('nav.about')}</Link>
            <Link to="/privacy" className="hover:text-slate-200">{t('nav.privacy')}</Link>
            <Link to="/contact" className="hover:text-slate-200">{t('nav.contact')}</Link>
            <Link to="/faq" className="hover:text-slate-200">{t('nav.faq')}</Link>
          </nav>
          <p className="sm:ms-auto">
            © {new Date().getFullYear()} RichPath (rebuild). {t('common.allRightsReserved')}
          </p>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
          Clean-room demonstration build. Not affiliated with, endorsed by, or connected to any third-party rewards
          site. No real payments are processed.
        </div>
      </footer>

      <LanguageModal open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  );
}

