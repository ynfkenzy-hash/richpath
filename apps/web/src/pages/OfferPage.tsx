import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../components/ui/index.js';

/**
 * Stand-in for a third-party offer landing page.
 *
 * In a live deployment the user is sent to the advertiser's own domain and this
 * route would not exist. It is included so the completion flow (start → engage
 * → server-verified completion) can be tested without an offerwall account.
 *
 * The `t` query parameter is a short-lived, server-signed proof token. The
 * client cannot mint one and cannot change the reward — credits are always
 * calculated server-side from the completion row.
 */
export function OfferPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const token = params.get('t') ?? '';
  const completionId = params.get('c') ?? '';
  const valid = token.length > 20 && completionId.length > 10;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-900 px-4">
      <Card className="w-full max-w-lg space-y-4">
        <p className="text-xs uppercase tracking-widest text-slate-500">Demo offer page</p>
        <h1 className="text-xl font-bold capitalize">{slug?.replace(/-/g, ' ')}</h1>

        {valid ? (
          <>
            <p className="text-sm text-slate-300">
              This page stands in for the advertiser&apos;s site. In a real deployment you would complete the offer
              here, and the advertiser&apos;s server — not your browser — would tell us that you finished.
            </p>
            <p className="rounded-xl border border-white/10 bg-ink-700/60 px-3 py-2 text-xs text-slate-400">
              Completion reference: <span className="font-mono">{completionId.slice(0, 8)}…</span>
            </p>
            <p className="text-xs text-slate-500">
              Your reward stays the same whether this page says the offer is worth $0.05 or $50 — the amount is fixed
              server-side when the task is started.
            </p>
          </>
        ) : (
          <p className="text-sm text-red-300">
            This offer link is missing its signed reference. Start the task from the Task Center so we can verify the
            completion.
          </p>
        )}

        <div className="flex gap-2">
          <Button block onClick={() => navigate('/task')}>
            {t('common.back')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
