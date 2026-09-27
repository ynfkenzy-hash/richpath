import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DailyState } from '@richpath/shared';
import { ApiRequestError, http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { countdown, money } from '../lib/format.js';
import { Alert, Button, Card, cx } from '../components/ui/index.js';

export function DailyPage() {
  const { t } = useTranslation();
  const client = useQueryClient();

  const daily = useQuery({ queryKey: qk.daily, queryFn: () => http.get<DailyState>('/daily') });

  const claim = useMutation({
    mutationFn: () => http.post<{ reward: number; streak: number }>('/daily/claim'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.daily });
      void client.invalidateQueries({ queryKey: qk.me });
    },
  });

  const error = claim.error instanceof ApiRequestError ? claim.error.message : null;
  const state = daily.data;
  const cycleDay = state?.claimedToday
    ? ((state.streak - 1) % (state.schedule.length || 7)) + 1
    : state?.cycleDay ?? 1;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('daily.title')}</h1>
        <p className="text-sm text-slate-400">{t('daily.subtitle')}</p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}
      {claim.isSuccess && (
        <Alert tone="success">
          {t('tasks.success')} — +{money(claim.data.reward)}
        </Alert>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t('daily.streak')}</p>
            <p className="text-3xl font-extrabold">
              {state?.streak ?? 0}
              <span className="ms-1 text-base font-medium text-slate-400">🔥</span>
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t('daily.today')}</p>
            <p className="text-3xl font-extrabold text-brand-400">{money(state?.todayReward ?? 0)}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{t('daily.schedule')}</p>
          <ol className="grid grid-cols-7 gap-1.5">
            {state?.schedule.map((slot) => {
              const isToday = slot.day === cycleDay;
              const isPast = slot.day < cycleDay;
              return (
                <li
                  key={slot.day}
                  className={cx(
                    'rounded-xl border px-1 py-2 text-center text-xs',
                    isToday
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                      : isPast
                        ? 'border-white/5 bg-ink-700/40 text-slate-400'
                        : 'border-white/10 bg-ink-700/20 text-slate-500',
                  )}
                >
                  <p className="font-semibold">D{slot.day}</p>
                  <p className="mt-0.5">{money(slot.reward, { currency: false })}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <Button
          block
          size="lg"
          disabled={state?.claimedToday}
          loading={claim.isPending}
          onClick={() => claim.mutate()}
        >
          {state?.claimedToday ? t('daily.claimed') : t('daily.claim')}
        </Button>

        {state?.claimedToday && state.nextClaimAt && (
          <p className="text-center text-xs text-slate-400">
            {t('daily.nextIn', { time: countdown(state.nextClaimAt) })}
          </p>
        )}
      </Card>
    </div>
  );
}
