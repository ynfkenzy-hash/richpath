import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../components/ui/index.js';

/** Shared shell so every static page looks identical and stays readable. */
function StaticShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <Link to="/user" className="text-sm text-brand-400 hover:underline">
        ← {t('common.back')}
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="space-y-4 text-sm leading-relaxed text-slate-300">{children}</Card>
    </div>
  );
}

/**
 * LEGAL PAGES ARE PLACEHOLDERS.
 * They describe the data handling this codebase actually performs, but they are
 * not legal advice and have not been reviewed. Have counsel draft real Terms,
 * a Privacy Policy and a Rewards/Payout Policy before you launch — several
 * jurisdictions also require specific disclosures for reward programmes.
 */
export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <StaticShell title={t('legal.privacyTitle')}>
      <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        {t('legal.demoNotice')}
      </p>
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-100">What this demo stores</h2>
        <ul className="list-disc space-y-1 ps-5">
          <li>Account data you type in: name, email, password hash (bcrypt), chosen language.</li>
          <li>Activity needed to pay you: task completions, video views, daily claims, invite relationships.</li>
          <li>Payout details you supply — stored only as a masked value plus a one-way hash, never in the clear.</li>
          <li>Security data: session records, login attempts, IP address at registration.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-100">What leaves your device</h2>
        <p>
          In this build, nothing. There are no analytics, advertising or tracking scripts wired in. If you add an
          offerwall provider, that provider will set its own cookies and process data under its own policy — disclose
          that before you enable it.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-100">Your rights</h2>
        <p>
          You can request a copy of your data or ask for deletion. In this code the account deletion path is
          deliberately not automated: erasing a ledger that may be subject to financial-retention rules is a business
          decision, not a button.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-100">Cookies</h2>
        <p>
          One httpOnly cookie holds your session. It is not used for advertising and there is no third-party cookie
          in this build.
        </p>
      </section>
    </StaticShell>
  );
}

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <StaticShell title={t('legal.aboutTitle')}>
      <p>
        RichPath (rebuild) is a clean-room demonstration of a rewards-platform user experience: task centre, video
        rewards, daily streaks, referrals, a payout checklist and a transaction log.
      </p>
      <p>
        It exists to show how such a product is engineered — typed API contracts, server-side validation, hold-and-
        release accounting, masked personal data and an honest error model — without copying anyone&apos;s source code.
      </p>
      <p className="rounded-xl border border-white/10 bg-ink-700/60 px-3 py-2 text-xs text-slate-300">
        Not affiliated with, endorsed by, or connected to any third-party rewards website. No real payments are
        processed in this build.
      </p>
    </StaticShell>
  );
}

export function ContactPage() {
  const { t } = useTranslation();
  // Overridable per environment (VITE_SUPPORT_EMAIL); the fallback keeps local
  // development working with no .env file at all.
  const email = import.meta.env.VITE_SUPPORT_EMAIL ?? 'Richard23@gmail.com';
  return (
    <StaticShell title={t('legal.contactTitle')}>
      <p>
        Support email:{' '}
        <a className="text-brand-400 underline" href={`mailto:${email}`}>
          {email}
        </a>
      </p>
      <p className="text-sm text-slate-400">
        Include your account email, the task or video name and the date — that is usually everything needed to
        trace a reward.
      </p>
      <p className="text-xs text-slate-500">
        We never ask for your password or a one-time code. Any message that does is not from us.
      </p>
      <p>
        A production build should wire this to a ticketing tool (Zendesk, Freshdesk, or a simple inbox plus an SLA)
        and include a support form with rate limiting so it cannot be used to spam.
      </p>
      <p className="text-xs text-slate-500">
        Never ask a member for their password or a one-time code. Support staff should not need either.
      </p>
    </StaticShell>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-extrabold text-brand-400">404</p>
      <h1 className="text-xl font-bold">{t('common.notFound')}</h1>
      <Link to="/">
        <Button>{t('common.goHome')}</Button>
      </Link>
    </div>
  );
}
