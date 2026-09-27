import { useEffect, useRef, useState } from 'react';

/**
 * ============================================================================
 *  YOUTUBE IFRAME PLAYER
 * ============================================================================
 *  Loads the official IFrame Player API once per page, embeds via
 *  youtube-nocookie.com (no tracking cookie until playback starts) and reports
 *  REAL playback progress: a second only counts while the player reports
 *  PLAYING. There is no wall-clock timer on the reward path, and the server
 *  re-validates the reported figure against the video's duration.
 *
 *  Errors are surfaced in plain language. Codes 101/150 mean the owner forbids
 *  embedding; 100/2 mean the video is gone; 5 means it cannot play embedded.
 *  Those are the cases that silently break reward programmes, so the caller is
 *  told about them (and can drop the video from rotation).
 * ============================================================================
 */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type PlayerErrorCode = 2 | 5 | 100 | 101 | 150;

export const playerErrorMessage = (code: number): string => {
  switch (code) {
    case 2:
      return 'That video id is not valid.';
    case 5:
      return 'That video can’t play in an embedded player.';
    case 100:
      return 'That video was removed or made private.';
    case 101:
    case 150:
      return 'The owner does not allow this video to be embedded.';
    default:
      return `Playback error (${code}).`;
  }
};

/** Errors that mean the video should be dropped from rotation. */
export const isFatalPlayerError = (code: number) => [2, 5, 100, 101, 150].includes(code);

let apiPromise: Promise<boolean> | null = null;

/** Injects the IFrame API once. Resolves false if it cannot load at all. */
export function loadPlayerApi(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.YT?.Player) return Promise.resolve(true);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 10_000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface YouTubePlayerProps {
  videoId: string;
  /** Fires once a second while the video is actually playing. */
  onProgress: (playedSeconds: number) => void;
  onEnded: (playedSeconds: number) => void;
  onError: (code: PlayerErrorCode, message: string) => void;
  onReady?: (durationSeconds: number) => void;
}

export function YouTubePlayer({ videoId, onProgress, onEnded, onError, onReady }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playedRef = useRef(0);
  const playingRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  // Keep the latest callbacks without re-creating the player.
  const cb = useRef({ onProgress, onEnded, onError, onReady });
  cb.current = { onProgress, onEnded, onError, onReady };

  useEffect(() => {
    let tick: number | undefined;
    let cancelled = false;

    loadPlayerApi().then((ok) => {
      if (cancelled) return;
      if (!ok || !window.YT?.Player || !hostRef.current) {
        setStatus('unavailable');
        return;
      }

      playerRef.current = new window.YT.Player(hostRef.current, {
        // Privacy-enhanced mode — no tracking cookie until playback starts.
        host: 'https://www.youtube-nocookie.com',
        videoId,
        // Only send `origin` when the page really has one; "null" (file://,
        // sandboxed iframe) breaks the player.
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          ...(window.location.origin.startsWith('http') ? { origin: window.location.origin } : {}),
        },
        events: {
          onReady: (event: any) => {
            setStatus('ready');
            const duration = event.target.getDuration();
            if (duration && Number.isFinite(duration)) cb.current.onReady?.(Math.round(duration));
          },
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (event.data === 1) playingRef.current = true;
            else playingRef.current = false;
            if (event.data === 0) {
              playingRef.current = false;
              cb.current.onEnded(playedRef.current);
            }
          },
          onError: (event: any) => {
            playingRef.current = false;
            cb.current.onError(event.data as PlayerErrorCode, playerErrorMessage(event.data));
          },
        },
      });

      tick = window.setInterval(() => {
        if (!playingRef.current) return;
        playedRef.current += 1;
        cb.current.onProgress(playedRef.current);
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (tick) window.clearInterval(tick);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* the iframe may already be gone with the modal */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  if (status === 'unavailable') {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-black p-6 text-center">
        <p className="text-sm font-semibold">YouTube can’t load here</p>
        <p className="max-w-sm text-xs text-slate-400">
          The player script was blocked — usually a sandboxed preview, an offline network, or a content blocker.
          Open the app in a normal browser tab, or switch to the simulated player to keep testing the flow.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
      <div ref={hostRef} className="absolute inset-0 h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/20 border-t-brand-500" />
        </div>
      )}
    </div>
  );
}
