import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VideoTask } from '@richpath/shared';
import { ApiRequestError, http } from '../lib/api.js';
import { qk } from '../lib/queryClient.js';
import { money } from '../lib/format.js';
import { Alert, Badge, Button, Card, EmptyState, Modal, Skeleton, cx } from '../components/ui/index.js';
import {
  isFatalPlayerError,
  YouTubePlayer,
  type PlayerErrorCode,
} from '../features/videos/YouTubePlayer.js';

interface VideoState {
  videos: VideoTask[];
  watchedToday: number;
  dailyLimit: number;
  bonusUnlocked: boolean;
  remainingTasksForBonus: number;
}

/** Placeholder ids from an older seed are not real videos. */
const isRealYouTubeId = (id: string) => /^[A-Za-z0-9_-]{11}$/.test(id);

const thumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export function VideoPage() {
  const { t } = useTranslation();
  const client = useQueryClient();

  const [openVideo, setOpenVideo] = useState<VideoTask | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Videos the player refused to embed this session — hidden from the list. */
  const [broken, setBroken] = useState<string[]>([]);
  const [simulated, setSimulated] = useState(false);

  const state = useQuery({ queryKey: qk.videos, queryFn: () => http.get<VideoState>('/videos') });

  const complete = useMutation({
    mutationFn: (payload: { id: string; secondsWatched: number }) =>
      http.post<{ reward: number; balance: number }>(`/videos/${payload.id}/complete`, {
        secondsWatched: payload.secondsWatched,
      }),
    onSuccess: (data) => {
      setMessage(`${t('tasks.success')} — +${money(data.reward)}`);
      setOpenVideo(null);
      void client.invalidateQueries({ queryKey: qk.videos });
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.daily });
    },
    onError: (err) => setMessage(err instanceof ApiRequestError ? err.message : t('errors.generic')),
  });

  const videos = (state.data?.videos ?? []).filter((v) => !broken.includes(v.youtubeId));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('videos.title')}</h1>
        <p className="text-sm text-slate-400">{t('videos.subtitle')}</p>
      </header>

      {message && <Alert tone="success">{message}</Alert>}

      {state.data && (
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone="info">
            {t('videos.remaining', {
              count: Math.max(0, state.data.dailyLimit - state.data.watchedToday),
              limit: state.data.dailyLimit,
            })}
          </Badge>
          {state.data.bonusUnlocked ? (
            <Badge tone="success">{t('videos.bonusUnlocked')}</Badge>
          ) : (
            <Badge tone="warning">
              {t('videos.bonusLocked', { count: state.data.remainingTasksForBonus, extra: 3 })}
            </Badge>
          )}
          <Badge>{simulated ? 'Simulated player' : '▶ YouTube'}</Badge>
          <button
            className="ms-auto text-xs text-slate-400 underline hover:text-slate-200"
            onClick={() => setSimulated((v) => !v)}
          >
            {simulated ? 'Use YouTube player' : 'Use simulated player'}
          </button>
        </Card>
      )}

      {state.isLoading && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {state.data && videos.length === 0 && <EmptyState title={t('videos.empty')} />}

      <ul className="grid gap-2 sm:grid-cols-2">
        {videos.map((video) => (
          <li key={video.id}>
            <Card className="flex items-center gap-3">
              <div className="relative h-[42px] w-[74px] shrink-0 overflow-hidden rounded-lg bg-ink-600">
                {isRealYouTubeId(video.youtubeId) ? (
                  <img
                    src={thumbnail(video.youtubeId)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => e.currentTarget.remove()}
                  />
                ) : (
                  <span className="grid h-full place-items-center text-brand-400">▶</span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/30 text-white/90">▶</span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{video.title}</p>
                <p className="truncate text-xs text-brand-400">
                  {money(video.reward)} / view · needs {video.requiredSeconds}s
                  {video.author ? ` · ${video.author}` : ''}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')} long
                </p>
              </div>

              <Button
                size="sm"
                variant={video.watched ? 'secondary' : 'primary'}
                disabled={video.watched}
                onClick={() => {
                  setMessage(null);
                  setOpenVideo(video);
                }}
              >
                {video.watched ? t('videos.watched') : t('videos.watch')}
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <Alert tone="info">
        <b>How crediting works.</b> Watch time is read from the player’s own state — a second only counts while the
        video is actually playing. Embeds use <code>youtube-nocookie.com</code>; Google still receives the request,
        so disclose that on your privacy page.
      </Alert>

      {openVideo && (
        <VideoModal
          video={openVideo}
          simulated={simulated || !isRealYouTubeId(openVideo.youtubeId)}
          submitting={complete.isPending}
          onClose={() => setOpenVideo(null)}
          onSubmit={(secondsWatched) => complete.mutate({ id: openVideo.id, secondsWatched })}
          onBroken={(youtubeId, reason) => {
            setBroken((list) => [...list, youtubeId]);
            setOpenVideo(null);
            setMessage(`${reason} That video was removed from your list.`);
          }}
        />
      )}
    </div>
  );
}

/* ========================================================================== */

function VideoModal({
  video,
  simulated,
  submitting,
  onClose,
  onSubmit,
  onBroken,
}: {
  video: VideoTask;
  simulated: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (secondsWatched: number) => void;
  onBroken: (youtubeId: string, reason: string) => void;
}) {
  const { t } = useTranslation();
  const [played, setPlayed] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [duration, setDuration] = useState(video.durationSeconds);
  const simTimer = useRef<number | null>(null);

  const required = video.requiredSeconds;
  const ready = played >= required;
  const progress = Math.min(100, (played / required) * 100);

  // Offline fallback: it can be credited, but only for real elapsed seconds —
  // the server validates the same threshold, so faking this changes nothing.
  useEffect(() => {
    if (!simulated) return;
    setPlayed(0);
    simTimer.current = window.setInterval(() => {
      setPlayed((value) => (value >= duration ? value : value + 1));
    }, 1000);
    return () => {
      if (simTimer.current) window.clearInterval(simTimer.current);
    };
  }, [simulated, duration]);

  const onPlayerError = (code: PlayerErrorCode, text: string) => {
    setPlayerError(text);
    if (isFatalPlayerError(code)) {
      // Keep the reason for the user, hand the id back so the caller can stop
      // offering a video that can never pay out.
      window.setTimeout(() => onBroken(video.youtubeId, text), 1200);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={video.title}
      footer={
        <>
          <Button
            block
            disabled={!ready || Boolean(playerError) || submitting}
            loading={submitting}
            onClick={() => onSubmit(played)}
          >
            {playerError ? 'Unavailable' : ready ? `${t('videos.watched')} — ${money(video.reward)}` : t('videos.keepWatching')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </>
      }
    >
      {simulated ? (
        <div className="rounded-xl border border-white/10 bg-ink-700 p-6 text-center">
          <p className="text-2xl">▶</p>
          <p className="mt-2 text-xs text-slate-400">
            {played}s / {required}s needed
          </p>
        </div>
      ) : (
        <YouTubePlayer
          videoId={video.youtubeId}
          onReady={(seconds) => setDuration(seconds)}
          onProgress={(seconds) => setPlayed(seconds)}
          onEnded={(seconds) => setPlayed(Math.max(seconds, required))}
          onError={onPlayerError}
        />
      )}

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className={cx(playerError ? 'text-red-300' : 'text-slate-400')}>
          {playerError ?? (ready ? 'Minimum watch time reached' : `${played}s watched · ${required}s required`)}
        </span>
        <a
          className="text-brand-400 underline"
          href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on YouTube ↗
        </a>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Only playback time counts. If a claim is rejected, the server re-checks the figure against this video’s
        duration ({Math.round(duration)}s).
      </p>

    </Modal>
  );
}

