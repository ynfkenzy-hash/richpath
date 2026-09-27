import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LedgerEntry, Paged, PublicUser, Task, DailyState } from '@richpath/shared';
import { http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { money, relativeTime } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Skeleton, Stat } from '../components/ui/index.js';

export function UserPage() {
  const { t } = useTranslation();

  const me = useQuery({ queryKey: qk.me, queryFn: () => http.get<{ user: PublicUser }>('/users/me') });
  const ledger = useQuery({
    queryKey: qk.ledger(1),
    queryFn: () => http.get<Paged<LedgerEntry>>('/users/me/ledger', { page: 1, pageSize: 6 }),
  });
  const tasks = useQuery({ queryKey: qk.tasks, queryFn: () => http.get<{ items: Task[] }>('/tasks') });
  const daily = useQuery({ queryKey: qk.daily, queryFn: () => http.get<DailyState>('/daily') });
  const eligibility = useQuery({
    queryKey: qk.eligibility,
    queryFn: () =>
      http.get<{ eligible: boolean; steps: { key: string; done: boolean; label: string }[] }>('/withdrawals/eligibility'),
  });

  const user = me.data?.user;
  const availableTasks = tasks.data?.items.filter((task) => !task.cooldownEndsAt).slice(0, 3) ?? [];
  const nextStep = eligibility.data?.steps.find((step) => !step.done);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">
          {t('dashboard.hello')}
          {user ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-sm text-slate-400">{t('dashboard.subtitle')}</p>
      </header>

      {/* ------------------------------------------------------------- balance */}
      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/15 to-transparent p-5">
        {me.isLoading ? (
          <Skeleton className="h-20 w-48" />
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-slate-300">{t('dashboard.withdrawable')}</p>
            <p className="mt-1 text-4xl font-extrabold text-brand-400">{money(user?.balance ?? 0)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <Badge>{t('dashboard.pending')}: {money(user?.pendingBalance ?? 0)}</Badge>
              <Badge>{t('dashboard.lifetime')}: {money(user?.lifetimeEarned ?? 0)}</Badge>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('dashboard.lifetime')} value={money(user?.lifetimeEarned ?? 0)} />
        <Stat label={t('dashboard.referrals')} value={String(user?.referralCount ?? 0)} />
        <Stat label={t('daily.streak')} value={String(daily.data?.streak ?? 0)} />
        <Stat label={t('dashboard.pending')} value={money(user?.pendingBalance ?? 0)} />
      </div>

      {/* -------------------------------------------------------- next action */}
      {nextStep && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('dashboard.nextPayout')}</p>
            <p className="mt-0.5 text-sm text-slate-400">{nextStep.label}</p>
          </div>
          <Link to={nextStep.key === 'balance' || nextStep.key === 'payment_method' ? '/withdraw' : nextStep.key === 'tasks' ? '/task' : '/withdraw'}>
            <Button variant="secondary" size="sm">
              {t('dashboard.viewAll')}
            </Button>
          </Link>
        </Card>
      )}

      {/* ------------------------------------------------------------- tasks */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('dashboard.quickTasks')}</h2>
          <Link to="/task" className="text-sm text-brand-400 hover:underline">
            {t('dashboard.viewAll')} →
          </Link>
        </div>
        {tasks.isLoading && <Skeleton className="h-24 w-full" />}
        {tasks.data && availableTasks.length === 0 && (
          <EmptyState title={t('tasks.empty')} action={<Link to="/video"><Button size="sm" variant="secondary">{t('nav.video')}</Button></Link>} />
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {availableTasks.map((task) => (
            <Card key={task.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: task.logoColor }}
                >
                  {task.title.slice(0, 2).toUpperCase()}
                </span>
                <p className="truncate text-sm font-semibold">{task.title}</p>
              </div>
              <p className="line-clamp-2 text-xs text-slate-400">{task.description}</p>
              <div className="mt-auto flex items-center justify-between">
                <span className="font-bold text-brand-400">{money(task.reward)}</span>
                <Link to="/task">
                  <Button size="sm">{t('tasks.start')}</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- activity */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('dashboard.recentActivity')}</h2>
          <Link to="/record" className="text-sm text-brand-400 hover:underline">
            {t('dashboard.viewAll')} →
          </Link>
        </div>
        {ledger.isLoading && <Skeleton className="h-32 w-full" />}
        {ledger.data && ledger.data.items.length === 0 && <EmptyState title={t('dashboard.noActivity')} />}
        {ledger.data && ledger.data.items.length > 0 && (
          <Card className="divide-y divide-white/5 p-0">
            {ledger.data.items.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span
                  className={
                    'flex h-8 w-8 items-center justify-center rounded-full ' +
                    (entry.amount >= 0 ? 'bg-brand-500/15 text-brand-400' : 'bg-white/5 text-slate-400')
                  }
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    {entry.amount >= 0 ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{entry.description}</p>
                  <p className="text-xs text-slate-500">{relativeTime(entry.createdAt)}</p>
                </div>
                <span className={entry.amount >= 0 ? 'font-semibold text-brand-400' : 'font-semibold text-slate-300'}>
                  {money(entry.amount, { signed: true })}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
