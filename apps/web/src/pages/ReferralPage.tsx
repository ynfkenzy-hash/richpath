import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReferralSummary } from '@richpath/shared';
import { ApiRequestError, http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { dateOnly, money } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, Skeleton, cx } from '../components/ui/index.js';

export function ReferralPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const summary = useQuery({ queryKey: qk.referrals, queryFn: () => http.get<ReferralSummary>('/referrals') });

  const claimDaily = useMutation({
    mutationFn: () => http.post<{ claimed: number }>('/referrals/claim-daily'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.referrals });
      void client.invalidateQueries({ queryKey: qk.me });
    },
  });

  const data = summary.data;
  const link = data ? `${window.location.origin}/login?mode=register&ref=${data.referralCode}` : '';

  const copy = async (value: string, which: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API needs a secure context; fall back to a prompt.
      window.prompt(t('common.copy'), value);
    }
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('referrals.title')}</h1>
        <p className="text-sm text-slate-400">{t('referrals.subtitle')}</p>
      </header>

      {claimDaily.isSuccess && <Alert tone="success">+{money(claimDaily.data.claimed)}</Alert>}
      {claimDaily.error instanceof ApiRequestError && <Alert tone="error">{claimDaily.error.message}</Alert>}

      {summary.isLoading && <Skeleton className="h-40 w-full" />}

      {data && (
        <>
          <Card className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{t('referrals.yourLink')}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-700/70 px-3 py-2 text-sm text-slate-200"
                />
                <Button size="sm" variant="secondary" onClick={() => copy(link, 'link')}>
                  {copied === 'link' ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-dashed border-brand-500/40 bg-brand-500/5 px-3 py-2">
                <span className="text-xs text-slate-400">{t('referrals.yourCode')} </span>
                <span className="font-mono font-bold tracking-widest text-brand-400">{data.referralCode}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copy(data.referralCode, 'code')}>
                {copied === 'code' ? t('common.copied') : t('common.copy')}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/5 bg-ink-700/50 py-2.5">
                <p className="text-lg font-bold">{data.referralCount}</p>
                <p className="text-[11px] text-slate-400">{t('referrals.invited')}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-ink-700/50 py-2.5">
                <p className="text-lg font-bold">{data.qualifiedCount}</p>
                <p className="text-[11px] text-slate-400">{t('referrals.qualified')}</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-ink-700/50 py-2.5">
                <p className="text-lg font-bold text-brand-400">{money(data.totalReferralEarnings)}</p>
                <p className="text-[11px] text-slate-400">{t('referrals.earned')}</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{t('referrals.dailyReward')}</p>
              <Badge tone={data.dailyRewardAvailable ? 'success' : 'neutral'}>
                {money(data.dailyRewardAmount)} / day
              </Badge>
            </div>
            <Button
              block
              disabled={!data.dailyRewardAvailable}
              loading={claimDaily.isPending}
              onClick={() => claimDaily.mutate()}
            >
              {data.dailyRewardAvailable
                ? t('referrals.dailyAvailable', { amount: money(data.dailyRewardAmount) })
                : data.dailyRewardAmount > 0
                  ? t('referrals.dailyClaimed')
                  : t('referrals.milestoneNext', { have: data.qualifiedCount, target: 3 })}
            </Button>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t('referrals.milestones')}</p>
              {data.milestones.map((milestone) => (
                <div key={milestone.target} className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cx('h-full rounded-full transition-all', milestone.reached ? 'bg-brand-500' : 'bg-accent/60')}
                      style={{ width: `${Math.min(100, (data.qualifiedCount / milestone.target) * 100)}%` }}
                    />
                  </div>
                  <span className="w-40 shrink-0 text-end text-xs text-slate-400">
                    {milestone.target} → {money(milestone.reward)}/day
                    {milestone.reached && <span className="ms-1 text-brand-400">✓</span>}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <section className="space-y-2">
            <h2 className="font-semibold">{t('referrals.listTitle')}</h2>
            {data.referrals.length === 0 ? (
              <EmptyState title={t('referrals.empty')} />
            ) : (
              <Card className="divide-y divide-white/5 p-0">
                {data.referrals.map((referral, index) => (
                  <div key={index} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs font-semibold">
                      {referral.maskedName.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{referral.maskedName}</p>
                      <p className="text-xs text-slate-500">{dateOnly(referral.joinedAt)}</p>
                    </div>
                    <span className="text-sm font-semibold text-brand-400">{money(referral.earned)}</span>
                  </div>
                ))}
              </Card>
            )}
            <p className="text-xs text-slate-500">Invitee names are masked — you never see their private details.</p>
          </section>

          <Card className="space-y-2 text-sm text-slate-300">
            <p className="font-semibold">{t('referrals.howTitle')}</p>
            <p>1. {t('referrals.how1')}</p>
            <p>2. {t('referrals.how2')}</p>
            <p>3. {t('referrals.how3', { percent: 10 })}</p>
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Inviting people is optional. Recruiting is never a requirement to get paid — any platform that ties
              withdrawals to recruitment is running an illegal pyramid scheme.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
