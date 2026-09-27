import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { PaymentMethod, PublicUser } from '@richpath/shared';
import { ApiRequestError, http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { money } from '../lib/format.js';
import { Alert, Badge, Button, Card, Field, Modal, Skeleton, cx } from '../components/ui/index.js';

interface Eligibility {
  eligible: boolean;
  balance: number;
  minBalance: number;
  creditedTasks: number;
  isFirstWithdrawal: boolean;
  reasons: { code: string; message: string; current?: number; required?: number }[];
  steps: { key: string; done: boolean; label: string }[];
}

export function WithdrawPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [pmOpen, setPmOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const me = useQuery({ queryKey: qk.me, queryFn: () => http.get<{ user: PublicUser }>('/users/me') });
  const eligibility = useQuery({ queryKey: qk.eligibility, queryFn: () => http.get<Eligibility>('/withdrawals/eligibility') });
  const methods = useQuery({
    queryKey: qk.paymentMethods,
    queryFn: () => http.get<{ items: PaymentMethod[] }>('/withdrawals/payment-methods'),
  });

  const form = useForm<{ amount: string; method: 'bank' | 'usdt' }>({
    defaultValues: { amount: '', method: 'bank' },
  });
  const method = form.watch('method');
  const balance = me.data?.user.balance ?? 0;
  const configured = methods.data?.items.find((item) => item.method === method);

  // Demo-only shortcut so reviewers can reach the cash-out flow without
  // grinding tasks. Hidden when VITE_DEMO_MODE=false, and the API disables the
  // endpoint entirely in production.
  const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false';
  const topUp = useMutation({
    mutationFn: () => http.post<{ user: PublicUser }>('/users/me/demo-topup'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.eligibility });
      void client.invalidateQueries({ queryKey: qk.ledger(1) });
    },
  });

  const request = useMutation({
    mutationFn: (payload: { amount: number; method: 'bank' | 'usdt' }) =>
      http.post<{ id: string; amount: number }>('/withdrawals', payload),
    onSuccess: (data) => {
      setConfirmOpen(false);
      setBanner({ tone: 'success', text: `${t('withdraw.success')} — ${money(data.amount)}` });
      form.reset({ amount: '', method });
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.eligibility });
      void client.invalidateQueries({ queryKey: qk.withdrawals });
      void client.invalidateQueries({ queryKey: qk.ledger(1) });
    },
    onError: (err) => {
      setConfirmOpen(false);
      setBanner({ tone: 'error', text: err instanceof ApiRequestError ? err.message : t('errors.generic') });
    },
  });

  const amountValue = Number(form.watch('amount'));
  const amountValid = Number.isFinite(amountValue) && amountValue > 0 && amountValue <= balance;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('withdraw.title')}</h1>
        <p className="text-sm text-slate-400">{t('withdraw.subtitle')}</p>
      </header>

      {banner && <Alert tone={banner.tone}>{banner.text}</Alert>}

      {demoMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-white/15 bg-ink-800/50 px-3.5 py-2.5 text-xs text-slate-400">
          <span className="flex-1">
            Demo build: rewards are simulated. Add a test balance to walk through the cash-out flow.
          </span>
          <Button size="sm" variant="secondary" loading={topUp.isPending} onClick={() => topUp.mutate()}>
            + $25 test balance
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/15 to-transparent p-5">
        <p className="text-xs uppercase tracking-wide text-slate-300">{t('withdraw.balance')}</p>
        <p className="mt-1 text-4xl font-extrabold text-brand-400">{money(balance)}</p>
        {eligibility.data && (
          <p className="mt-1 text-xs text-slate-400">
            {t('withdraw.minAmount', { amount: money(eligibility.data.minBalance) })}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- eligibility */}
      {eligibility.isLoading && <Skeleton className="h-32 w-full" />}
      {eligibility.data && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{t('withdraw.eligibility')}</p>
            <Badge tone={eligibility.data.eligible ? 'success' : 'warning'}>
              {eligibility.data.eligible ? t('stepsDoneLabel', { defaultValue: 'Ready' }) : t('withdraw.notEligible')}
            </Badge>
          </div>
          <ul className="space-y-2">
            {eligibility.data.steps.map((step) => (
              <li key={step.key} className="flex items-center gap-2.5 text-sm">
                <span
                  className={cx(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    step.done ? 'bg-brand-500/20 text-brand-400' : 'bg-white/5 text-slate-400',
                  )}
                >
                  {step.done ? '✓' : '•'}
                </span>
                <span className={step.done ? 'text-slate-300' : 'text-slate-400'}>{step.label}</span>
              </li>
            ))}
          </ul>
          {eligibility.data.reasons.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              {eligibility.data.reasons.map((reason) => (
                <li key={reason.code}>• {reason.message}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------------ payout */}
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['bank', 'usdt'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => form.setValue('method', option)}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-sm font-medium transition',
                method === option
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                  : 'border-white/10 text-slate-300 hover:bg-white/5',
              )}
            >
              {option === 'bank' ? t('withdraw.bank') : t('withdraw.usdt')}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-700/50 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{t('withdraw.pmTitle')}</p>
            <p className="truncate">
              {configured ? `${configured.accountName} · ${configured.destinationMasked}` : '—'}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPmOpen(true)}>
            {configured ? t('common.save') : t('withdraw.pmSave')}
          </Button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmOpen(true);
          }}
          className="space-y-3"
        >
          <Field
            label={t('withdraw.amount')}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            {...form.register('amount', {
              required: t('common.required'),
              validate: (value) => Number(value) > 0 || t('common.required'),
            })}
            error={form.formState.errors.amount?.message}
            hint={`${t('withdraw.balance')}: ${money(balance)}`}
          />

          <Button
            type="submit"
            block
            size="lg"
            disabled={!eligibility.data?.eligible || !amountValid || !configured}
          >
            {t('withdraw.submit')}
          </Button>

          <p className="text-xs text-slate-500">{t('withdraw.holdNote')}</p>
        </form>
      </Card>

      <PaymentMethodModal open={pmOpen} onClose={() => setPmOpen(false)} />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('withdraw.submit')}
        footer={
          <>
            <Button block loading={request.isPending} onClick={() => request.mutate({ amount: amountValue, method })}>
              {t('common.confirm')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <p>
          {money(amountValue)} → {configured?.destinationMasked}
        </p>
        <p className="text-xs text-slate-400">{t('withdraw.holdNote')}</p>
      </Modal>
    </div>
  );
}

function PaymentMethodModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<{ method: 'bank' | 'usdt'; accountName: string; destination: string }>({
    defaultValues: { method: 'bank', accountName: '', destination: '' },
  });

  const save = useMutation({
    mutationFn: (values: { method: 'bank' | 'usdt'; accountName: string; destination: string }) =>
      http.put<{ items: PaymentMethod[] }>('/withdrawals/payment-methods', values),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.paymentMethods });
      void client.invalidateQueries({ queryKey: qk.eligibility });
      setError(null);
      onClose();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : t('errors.generic')),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('withdraw.pmTitle')}
      footer={
        <>
          <Button block loading={save.isPending} onClick={form.handleSubmit((values) => save.mutate(values))}>
            {t('withdraw.pmSave')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </>
      }
    >
      <p className="text-slate-400">{t('withdraw.pmSubtitle')}</p>
      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['bank', 'usdt'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => form.setValue('method', option)}
              className={cx(
                'rounded-xl border px-3 py-2 text-sm',
                form.watch('method') === option
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                  : 'border-white/10 text-slate-300',
              )}
            >
              {option === 'bank' ? t('withdraw.bank') : t('withdraw.usdt')}
            </button>
          ))}
        </div>

        <Field
          label={t('withdraw.pmAccountName')}
          autoComplete="name"
          {...form.register('accountName', { required: t('common.required'), minLength: { value: 2, message: t('common.required') } })}
          error={form.formState.errors.accountName?.message}
        />
        <Field
          label={t('withdraw.pmDestination')}
          {...form.register('destination', { required: t('common.required'), minLength: { value: 6, message: t('common.required') } })}
          error={form.formState.errors.destination?.message}
          hint={t('withdraw.pmSecurity')}
        />
      </form>
    </Modal>
  );
}
