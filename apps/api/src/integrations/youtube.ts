/**
 * ============================================================================
 *  YOUTUBE DATA API v3 — INTEGRATION POINT (server-side)
 * ============================================================================
 *  Why this lives on the server: a YouTube Data API key used from a browser is
 *  a public key. Anyone can read it, and quota theft is the usual outcome.
 *  Route every discovery call through here so the key never ships to a client.
 *
 *  Quota reality check (default 10,000 units/day):
 *    search.list .......... 100 units  → ~100 searches/day
 *    videos.list ..........   1 unit   → durations for up to 50 ids
 *  So discovery is deliberately a low-frequency, operator-driven action, not
 *  something that runs per page view. Cache results in the `videos` table.
 *
 *  Reading the key is the only thing this module does on its own; persisting a
 *  discovered video into your catalogue is an explicit operator action so that
 *  rewards can only ever be paid for videos the server knows about.
 * ============================================================================
 */
import { config } from '../config.js';

export interface DiscoveredVideo {
  youtubeId: string;
  title: string;
  author: string;
  durationSeconds: number;
}

export interface DiscoverResult {
  items: DiscoveredVideo[];
  quotaUnitsUsed: number;
  note: string;
}

export class YouTubeNotConfiguredError extends Error {
  constructor() {
    super(
      'YOUTUBE_API_KEY is not set. Add it to .env to enable video discovery (see docs/06-api-requirements.md).',
    );
    this.name = 'YouTubeNotConfiguredError';
  }
}

/** ISO-8601 duration (PT1H2M3S) → seconds. Returns 0 for live/upcoming (no duration). */
export function isoDurationToSeconds(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

const YT = 'https://www.googleapis.com/youtube/v3';

async function ytFetch(path: string, params: Record<string, string>): Promise<any> {
  if (!config.integrations.youtube.apiKey) throw new YouTubeNotConfiguredError();
  const url = `${YT}/${path}?${new URLSearchParams({ ...params, key: config.integrations.youtube.apiKey })}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? `http_${res.status}`;
    throw new Error(`YouTube API rejected the request (${reason}): ${body?.error?.message ?? 'unknown error'}`);
  }
  return body;
}

/**
 * Random-ish embeddable videos for a query.
 * Filters that matter:
 *   videoEmbeddable=true  — the owner allows embedding; without this you get
 *                           error 101/150 in the player and users lose rewards.
 *   videoSyndicated=true  — playable outside youtube.com
 *   safeSearch=strict     — brand safety
 *   type=video            — no channels/playlists
 * Live and upcoming entries are dropped afterwards: they have no duration and
 * never emit ENDED, so they cannot satisfy a completion rule.
 */
export async function discoverVideos(query: string, maxResults = 12): Promise<DiscoverResult> {
  const search = await ytFetch('search', {
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'strict',
    maxResults: String(Math.min(25, Math.max(1, maxResults))),
    q: query,
  });

  const ids: string[] = (search.items ?? [])
    .map((i: any) => i?.id?.videoId)
    .filter((v: unknown): v is string => typeof v === 'string');

  if (ids.length === 0) return { items: [], quotaUnitsUsed: 100, note: 'No embeddable results for that query.' };

  const details = await ytFetch('videos', { part: 'contentDetails,snippet', id: ids.join(',') });
  const byId = new Map<string, any>((details.items ?? []).map((v: any) => [v.id, v]));

  const items: DiscoveredVideo[] = ids
    .map((id) => {
      const d = byId.get(id);
      return {
        youtubeId: id,
        title: d?.snippet?.title ?? 'Untitled',
        author: d?.snippet?.channelTitle ?? '',
        durationSeconds: isoDurationToSeconds(d?.contentDetails?.duration),
      };
    })
    .filter((v) => v.durationSeconds > 0); // exclude live/upcoming

  return {
    items,
    quotaUnitsUsed: 101,
    note: 'Discovery only. Persist a video into the catalogue before it can pay a reward.',
  };
}
