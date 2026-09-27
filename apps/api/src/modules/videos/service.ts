import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { applyLedger, audit } from '../../lib/ledger.js';
import { utcDate } from '../../lib/time.js';
import { creditReferrerShare } from '../tasks/service.js';

interface VideoRow {
  id: string;
  youtube_id: string;
  title: string;
  reward_cents: number;
  duration_seconds: number;
  author: string;
}

/** Videos unlocked as a bonus once the user finishes enough tasks. */
const BONUS_UNLOCK_TASKS = 3;
const BONUS_EXTRA_VIDEOS = 3;

export function getVideoState(userId: string) {
  const db = getDb();
  const today = utcDate();

  const creditedTasks = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM task_completions WHERE user_id = ? AND status = 'credited'`)
      .get(userId) as { c: number }
  ).c;

  const bonusUnlocked = creditedTasks >= BONUS_UNLOCK_TASKS;
  const dailyLimit = config.economy.videoDailyLimit + (bonusUnlocked ? BONUS_EXTRA_VIDEOS : 0);

  const watchedToday = db
    .prepare(
      `SELECT video_id, MAX(seconds_watched) AS seconds
         FROM video_views
        WHERE user_id = ? AND date(watched_at) = ?
        GROUP BY video_id`,
    )
    .all(userId, today) as { video_id: string; seconds: number }[];

  const videos = db
    .prepare(`SELECT * FROM videos WHERE active = 1 ORDER BY sort_order, title LIMIT ?`)
    .all(dailyLimit) as VideoRow[];

  return {
    videos: videos.map((v) => ({
      id: v.id,
      youtubeId: v.youtube_id,
      title: v.title,
      author: v.author,
      reward: v.reward_cents / 100,
      durationSeconds: v.duration_seconds,
      /** Playback seconds the client must reach before a claim is accepted. */
      requiredSeconds: Math.min(
        config.economy.videoMinPlaybackSeconds,
        Math.ceil(v.duration_seconds * 0.9),
      ),
      watched: watchedToday.some((w) => w.video_id === v.id),
    })),
    watchedToday: watchedToday.length,
    dailyLimit,
    bonusUnlocked,
    remainingTasksForBonus: Math.max(0, BONUS_UNLOCK_TASKS - creditedTasks),
  };
}

interface CompleteVideoInput {
  secondsWatched: number;
}

export function completeVideo(userId: string, videoId: string, input: CompleteVideoInput, ip: string) {
  const db = getDb();
  const video = db.prepare('SELECT * FROM videos WHERE id = ? AND active = 1').get(videoId) as VideoRow | undefined;
  if (!video) throw NotFound('That video is no longer available');

  const today = utcDate();

  const state = getVideoState(userId);
  if (state.watchedToday >= state.dailyLimit) {
    throw Conflict('video_limit', 'You have reached today\'s video limit. Come back tomorrow.');
  }

  const already = db
    .prepare(`SELECT 1 FROM video_views WHERE user_id = ? AND video_id = ? AND date(watched_at) = ?`)
    .get(userId, videoId, today);
  if (already) throw Conflict('already_watched', 'Already watched this video.');

  // Client-reported watch time is only a hint. The requirement mirrors the
  // player-side rule: min(cap, 90% of duration). In production, corroborate it
  // with a server-side signal (provider postback, or your own player beacon)
  // rather than trusting the browser for anything of real value.
  const required = Math.min(
    config.economy.videoMinPlaybackSeconds,
    Math.ceil(video.duration_seconds * 0.9),
  );
  if (input.secondsWatched < required) {
    throw BadRequest('not_enough_time', 'Keep watching until the end of the video.', {
      requiredSeconds: required,
    });
  }

  return tx(() => {
    db.prepare(
      `INSERT INTO video_views (id, user_id, video_id, seconds_watched, reward_cents)
       VALUES (?,?,?,?,?)`,
    ).run(crypto.randomUUID(), userId, video.id, input.secondsWatched, video.reward_cents);

    applyLedger({
      userId,
      amountCents: video.reward_cents,
      type: 'video',
      description: `Video reward: ${video.title}`,
      refType: 'video',
      refId: video.id,
    });
    creditReferrerShare(userId, video.reward_cents, video.id);

    const user = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number };
    audit(userId, 'video_complete', ip, { videoId });
    return {
      reward: video.reward_cents / 100,
      balance: user.balance_cents / 100,
      watchedToday: state.watchedToday + 1,
      dailyLimit: state.dailyLimit,
    };
  });
}
