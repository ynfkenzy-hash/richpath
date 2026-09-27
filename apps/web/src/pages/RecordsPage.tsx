import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LedgerEntry, Paged, Withdrawal } from '@richpath/shared';
import { http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { dateTime, money } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, Skeleton, cx } from '../components/ui/index.js';

type Tab = 'ledger' | 'payments';

export function RecordsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('ledger');
  const [page, setPage] = useState(1);

  const ledger = useQuery({
    queryKey: qk.ledger(page),
    queryFn: () => http.get<Paged<LedgerEntry>>('/users/me/ledger', { page, pageSize: 15 }),
    enabled: tab === 'ledger',
  });

  const withdrawals = useQuery({
    queryKey: qk.withdrawals,
    queryFn: () => http.get<{ items: Withdrawal[] }>('/withdrawals'),
    enabled: tab === 'payments',
  });

  const statusTone: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
    pending: 'warning',
    under_review: 'info',
    payout_sent: 'success',
    failed: 'danger',
  };
  const statusLabel: Record<string, string> = {
    pending: t('records.statusPending'),
    under_review: t('records.statusUnderReview'),
    payout_sent: t('records.statusPaid'),
    failed: t('records.statusFailed'),
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('records.title')}</h1>
        <p className="text-sm text-slate-400">{t('records.subtitle')}</p>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-700/70 p-1">
        {(['ledger', 'payments'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              'rounded-lg py-2 text-sm font-semibold transition',
              tab === key ? 'bg-brand-500 text-ink-900' : 'text-slate-300 hover:bg-white/5',
            )}
          >
            {key === 'ledger' ? t('records.ledger') : t('records.payments')}
          </button>
        ))}
      </div>

      {tab === 'ledger' && (
        <>
          {ledger.isLoading && <Skeleton className="h-64 w-full" />}
          {ledger.data && ledger.data.items.length === 0 && <EmptyState title={t('records.noLedger')} />}
          {ledger.data && ledger.data.items.length > 0 && (
            <>
              <Card className="divide-y divide-white/5 p-0">
                {ledger.data.items.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-20 shrink-0 text-xs text-slate-500">{dateTime(entry.createdAt).split(',')[0]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{entry.description}</p>
                      <p className="text-xs capitalize text-slate-500">{entry.type}</p>
                    </div>
                    <div className="text-end">
                      <p className={entry.amount >= 0 ? 'font-semibold text-brand-400' : 'font-semibold text-slate-300'}>
                        {money(entry.amount, { signed: true })}
                      </p>
                      <p className="text-xs text-slate-500">{money(entry.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </Card>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {ledger.data.page} / {Math.max(1, Math.ceil(ledger.data.total / ledger.data.pageSize))}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    {t('common.back')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page * ledger.data.pageSize >= ledger.data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'payments' && (
        <>
          {withdrawals.isLoading && <Skeleton className="h-48 w-full" />}
          {withdrawals.data && withdrawals.data.items.length === 0 && (
            <EmptyState title={t('records.noPayments')} />
          )}
          {withdrawals.data && withdrawals.data.items.length > 0 && (
            <Card className="divide-y divide-white/5 p-0">
              {withdrawals.data.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{money(item.amount)}</p>
                    <p className="text-xs text-slate-500">
                      {item.method === 'bank' ? t('withdraw.bank') : t('withdraw.usdt')} · {item.destinationMasked}
                    </p>
                    <p className="text-xs text-slate-500">{dateTime(item.createdAt)}</p>
                    {item.note && <p className="text-xs text-slate-400">{item.note}</p>}
                  </div>
                  <Badge tone={statusTone[item.status] ?? 'neutral'}>{statusLabel[item.status] ?? item.status}</Badge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
