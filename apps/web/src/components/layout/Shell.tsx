import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { DailyState } from '@richpath/shared';
import { useAuth } from '../../features/auth/AuthProvider.js';
import { http } from '../../lib/api.js';
import { qk } from '../../lib/queryClient.js';
import { money } from '../../lib/format.js';
import { Button, cx } from '../ui/index.js';
import { LanguageModal } from './LanguageModal.js';
import { Logo } from './Logo.js';

interface NavItem {
  to: string;
  key: string;
  icon: JSX.Element;
  badge?: 'fire' | 'dot';
}

const Icon = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  ),
  invite: <path d="M12 5v14M5 12h14" />,
  task: <path d="M9 11l3 3 7-7M4 6h6M4 12h4M4 18h8" />,
  video: <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3z" />,
  daily: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />,
  cash: <path d="M3 7h18v10H3zM7 12h.01M17 12h.01M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />,
  records: <path d="M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5" />,
  faq: <path d="M12 18h.01M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M4 5h16v14H4z" />,
};

const primaryNav: NavItem[] = [
  { to: '/user', key: 'nav.home', icon: Icon.home },
  { to: '/partners', key: 'nav.invite', icon: Icon.invite, badge: 'fire' },
  { to: '/task', key: 'nav.tasks', icon: Icon.task, badge: 'fire' },
  { to: '/video', key: 'nav.video', icon: Icon.video, badge: 'fire' },
  { to: '/daily', key: 'nav.daily', icon: Icon.daily, badge: 'dot' },
];

const secondaryNav: NavItem[] = [
  { to: '/withdraw', key: 'nav.cash', icon: Icon.cash },
  { to: '/record', key: 'nav.records', icon: Icon.records },
  { to: '/faq', key: 'nav.faq', icon: Icon.faq },
];

export function Shell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Close the drawer whenever the route changes (mobile pattern).
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Keep the balance chip fresh without polling aggressively.
  const me = useQuery({
    queryKey: qk.me,
    queryFn: () => http.get<{ user: typeof user }>('/users/me'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
    refetchOnMount: 'always',
  });
  const balance = me.data?.user?.balance ?? user?.balance ?? 0;

  const daily = useQuery({
    queryKey: qk.daily,
    queryFn: () => http.get<DailyState>('/daily'),
    enabled: Boolean(user),
  });
  const bonusReady = daily.data && !daily.data.claimedToday;

  const groups: { title: string; items: NavItem[] }[] = [
    { title: t('nav.hugeProfits'), items: primaryNav },
    { title: t('nav.cash') + ' & ' + t('nav.records'), items: secondaryNav },
    {
      title: t('nav.about'),
      items: [
        { to: '/about', key: 'nav.about', icon: Icon.faq },
        { to: '/privacy', key: 'nav.privacy', icon: Icon.records },
        { to: '/faq', key: 'nav.faq', icon: Icon.faq },
        { to: '/contact', key: 'nav.contact', icon: Icon.invite },
      ],
    },
  ];

  return (
    <div className="min-h-dvh bg-ink-900">
      {/* ------------------------------------------------------------ top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
            className="-ms-2 rounded-lg p-2 text-slate-300 hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          <NavLink to="/user" className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-base font-extrabold tracking-tight">
              Rich<span className="text-brand-400">Path</span>
            </span>
          </NavLink>

          <div className="ms-auto flex items-center gap-2">
            <button
              onClick={() => setLangOpen(true)}
              aria-label={t('nav.language')}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/5"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
            </button>
            <div className="rounded-full border border-white/10 bg-ink-700/70 px-3 py-1.5 text-sm font-semibold">
              <span className="text-slate-400">{t('common.balance')} </span>
              <span className="text-brand-400">{money(balance)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl">
        {/* -------------------------------------------------------- side drawer */}
        <div
          className={cx(
            'fixed inset-0 z-40 transition-opacity lg:relative lg:z-0 lg:inset-auto lg:transition-none',
            menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0 lg:pointer-events-auto lg:opacity-100',
          )}
        >
          <div
            className="absolute inset-0 bg-black/60 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label={t('nav.menu')}
            className={cx(
              'absolute inset-y-0 start-0 flex w-[280px] flex-col overflow-y-auto border-e border-white/5 bg-ink-800 pb-24',
              'transition-transform duration-300 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0 lg:pb-4 rtl:translate-x-[-100%] lg:rtl:translate-x-0',
              menuOpen ? 'translate-x-0 rtl:translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-400">
                {user?.name?.slice(0, 2).toUpperCase() ?? 'RP'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">@{user?.referralCode?.toLowerCase()}</p>
              </div>
            </div>

            {groups.map((group) => (
              <div key={group.title} className="px-2 py-3">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to + item.key}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                        isActive ? 'bg-brand-500/12 text-brand-400' : 'text-slate-200 hover:bg-white/5',
                      )
                    }
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
                      {item.icon}
                    </svg>
                    <span className="flex-1">{t(item.key)}</span>
                    {item.badge === 'fire' && <span aria-hidden="true">🔥</span>}
                    {item.badge === 'dot' && bonusReady && (
                      <span className="h-2 w-2 rounded-full bg-brand-400" aria-label="Bonus available" />
                    )}
                  </NavLink>
                ))}
              </div>
            ))}

            <div className="mt-auto border-t border-white/5 p-3">
              <Button
                variant="secondary"
                block
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                {t('common.signOut')}
              </Button>
            </div>
          </nav>
        </div>

        {/* -------------------------------------------------------------- main */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* -------------------------------------------------------- bottom tabs */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-ink-900/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {[primaryNav[0]!, primaryNav[2]!, primaryNav[1]!, primaryNav[3]!, { to: '/withdraw', key: 'nav.cash', icon: Icon.cash } as NavItem].map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium',
                    isActive ? 'text-brand-400' : 'text-slate-400',
                  )
                }
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                  {item.icon}
                </svg>
                {t(item.key)}
              </NavLink>
            ),
          )}
        </div>
      </nav>

      <LanguageModal open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  );
}
