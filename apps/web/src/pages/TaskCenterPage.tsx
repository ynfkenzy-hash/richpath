import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@richpath/shared';
import { ApiRequestError, http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { countdown, money } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, Modal, Skeleton, cx } from '../components/ui/index.js';

type Filter = 'all' | 'game' | 'survey' | 'app';

interface StartResponse {
  completionId: string;
  startUrl: string;
  reward: number;
  minEngagementSeconds: number;
}

export function TaskCenterPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState<{ task: Task; start: StartResponse } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'info' | 'error'; text: string } | null>(null);

  const tasks = useQuery({
    queryKey: qk.tasks,
    queryFn: () => http.get<{ items: Task[] }>('/tasks'),
    refetchInterval: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: (taskId: string) => http.post<StartResponse>(`/tasks/${taskId}/start`),
    onSuccess: (data, taskId) => {
      const task = tasks.data?.items.find((item) => item.id === taskId);
      if (!task) return;
      // The mock offerwall lives inside this app; a real provider would be a
      // different origin, which is why the URL is opened in a new tab.
      setActive({ task, start: data });
    },
    onError: (err) => {
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : t('errors.generic') });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (payload: { taskId: string; completionId: string; proofToken: string }) =>
      http.post<{ status: 'credited' | 'pending_review'; reward: number }>(`/tasks/${payload.taskId}/complete`, {
        completionId: payload.completionId,
        proofToken: payload.proofToken,
      }),
    onSuccess: (data) => {
      setActive(null);
      setMessage({
        tone: data.status === 'credited' ? 'success' : 'info',
        text:
          data.status === 'credited'
            ? `${t('tasks.success')} — +${money(data.reward)}`
            : t('tasks.pendingBody'),
      });
      void client.invalidateQueries({ queryKey: qk.tasks });
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.session });
    },
    onError: (err) => {
      setActive(null);
      setMessage({ tone: 'error', text: err instanceof ApiRequestError ? err.message : t('errors.generic') });
    },
  });

  const visible = useMemo(() => {
    const items = tasks.data?.items ?? [];
    return filter === 'all' ? items : items.filter((task) => task.category === filter);
  }, [tasks.data, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('tasks.filterAll') },
    { key: 'game', label: t('tasks.filterGames') },
    { key: 'survey', label: t('tasks.filterSurveys') },
    { key: 'app', label: t('tasks.filterApps') },
  ];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('tasks.title')}</h1>
        <p className="text-sm text-slate-400">{t('tasks.subtitle')}</p>
      </header>

      {message && (
        <Alert tone={message.tone === 'error' ? 'error' : message.tone === 'success' ? 'success' : 'info'}>
          {message.text}
        </Alert>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition',
              filter === item.key
                ? 'border-brand-500/40 bg-brand-500/15 text-brand-400'
                : 'border-white/10 text-slate-300 hover:bg-white/5',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tasks.isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {tasks.isError && (
        <Alert tone="error" title={t('errors.generic')}>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => tasks.refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      )}

      {tasks.data && visible.length === 0 && <EmptyState title={t('tasks.empty')} />}

      <ul className="space-y-2">
        {visible.map((task) => {
          const onCooldown = Boolean(task.cooldownEndsAt);
          const credited = task.completion?.status === 'credited';
          return (
            <li key={task.id}>
              <Card className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: task.logoColor }}
                  aria-hidden="true"
                >
                  {task.title.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{task.title}</p>
                    {credited && !onCooldown && <Badge tone="success">{t('tasks.completed')}</Badge>}
                    {onCooldown && <Badge tone="warning">{t('tasks.onCooldown', { time: countdown(task.cooldownEndsAt!) })}</Badge>}
                  </div>
                  <p className="line-clamp-1 text-xs text-slate-400">{task.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('tasks.duration', { minutes: task.estimatedMinutes })}
                  </p>
                </div>

                <div className="shrink-0 text-end">
                  <p className="font-bold text-brand-400">{money(task.reward)}</p>
                  <Button
                    size="sm"
                    className="mt-1"
                    disabled={onCooldown}
                    loading={startMutation.isPending && startMutation.variables === task.id}
                    onClick={() => {
                      setMessage(null);
                      startMutation.mutate(task.id);
                    }}
                  >
                    {onCooldown ? t('tasks.onCooldown', { time: countdown(task.cooldownEndsAt!) }) : t('tasks.start')}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <OfferModal
        active={active}
        submitting={completeMutation.isPending}
        onClose={() => setActive(null)}
        onComplete={() => {
          if (!active) return;
          const token = new URLSearchParams(active.start.startUrl.split('?')[1] ?? '').get('t') ?? '';
          completeMutation.mutate({
            taskId: active.task.id,
            completionId: active.start.completionId,
            proofToken: token,
          });
        }}
      />
    </div>
  );
}

/**
 * In-app stand-in for the provider's offer page. A real offerwall sends the
 * user to the advertiser's own site and reports the completion back through a
 * signed server-to-server postback — nothing in the browser can be trusted.
 */
function OfferModal({
  active,
  onClose,
  onComplete,
  submitting,
}: {
  active: { task: Task; start: StartResponse } | null;
  onClose: () => void;
  onComplete: () => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Restart the engagement countdown each time a new offer opens. The countdown
  // is a UX hint only: the server independently re-checks elapsed time when the
  // completion is submitted and rejects it if the window has not passed.
  useEffect(() => {
    if (!active) return;
    setSecondsLeft(active.start.minEngagementSeconds);
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const ready = secondsLeft <= 0;

  return (
    <Modal
      open={Boolean(active)}
      onClose={onClose}
      title={active?.task.title ?? ''}
      footer={
        <>
          <Button block disabled={!ready} loading={submitting} onClick={onComplete}>
            {ready ? t('tasks.completed') : `${secondsLeft}s`}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </>
      }
    >
      <p>{active?.task.description}</p>
      <div className="rounded-xl border border-white/10 bg-ink-700/60 p-3 text-xs text-slate-300">
        <p className="font-semibold text-slate-200">Demo offer page</p>
        <p className="mt-1">
          A live build would send you to the advertiser here and credit your account when the advertiser's server
          confirms the completion. This stand-in exists so the flow can be tested end to end.
        </p>
      </div>
      <p className="text-xs text-slate-400">
        {t('tasks.reward')}: <span className="font-semibold text-brand-400">{money(active?.task.reward ?? 0)}</span>
      </p>
    </Modal>
  );
}
