/**
 * Seed data for the demo build.
 *
 * IMPORTANT: every task, video, review and activity entry below is ORIGINAL
 * placeholder content written for this rebuild. No names, reviews, logos or
 * brands are taken from the reference site. Reviews and the payout ticker are
 * flagged `is_demo = 1` so the UI labels them as sample data.
 */
import { getDb } from './index.js';
import { newId } from '../lib/crypto.js';
import { migrate } from './migrate.js';

interface SeedTask {
  slug: string;
  title: string;
  description: string;
  category: 'game' | 'survey' | 'app' | 'signup';
  rewardCents: number;
  estMinutes: number;
  logoColor: string;
}

const TASKS: SeedTask[] = [
  {
    slug: 'dragon-merge-saga',
    title: 'Dragon Merge Saga',
    description: 'Install the game and reach level 5 to complete the offer.',
    category: 'game',
    rewardCents: 120,
    estMinutes: 8,
    logoColor: '#6D5AE6',
  },
  {
    slug: 'idle-space-mine',
    title: 'Idle Space Mine',
    description: 'Open the app, finish the tutorial and let the mine run for 3 minutes.',
    category: 'app',
    rewardCents: 65,
    estMinutes: 5,
    logoColor: '#2F6BFF',
  },
  {
    slug: 'puzzle-kingdom',
    title: 'Puzzle Kingdom',
    description: 'Complete the first 10 puzzle levels.',
    category: 'game',
    rewardCents: 90,
    estMinutes: 10,
    logoColor: '#E6723A',
  },
  {
    slug: 'streaming-habits-survey',
    title: 'Streaming Habits Study',
    description: 'Share your viewing preferences in a 12-question survey (about 3 minutes).',
    category: 'survey',
    rewardCents: 45,
    estMinutes: 4,
    logoColor: '#18A67C',
  },
  {
    slug: 'weekly-grocery-survey',
    title: 'Weekly Grocery Survey',
    description: 'Tell us how you shop for groceries. Answers stay anonymous.',
    category: 'survey',
    rewardCents: 30,
    estMinutes: 3,
    logoColor: '#C8455C',
  },
  {
    slug: 'word-voyage',
    title: 'Word Voyage',
    description: 'Reach chapter 3 in the word game.',
    category: 'game',
    rewardCents: 55,
    estMinutes: 7,
    logoColor: '#3B8ED0',
  },
  {
    slug: 'budget-tracker-app',
    title: 'Budget Tracker App',
    description: 'Create an account and log one expense.',
    category: 'signup',
    rewardCents: 80,
    estMinutes: 4,
    logoColor: '#8A5CF6',
  },
  {
    slug: 'fitness-habit-app',
    title: 'Fitness Habit App',
    description: 'Install the app and complete the onboarding questionnaire.',
    category: 'app',
    rewardCents: 40,
    estMinutes: 3,
    logoColor: '#E0A82E',
  },
  {
    slug: 'travel-preferences-study',
    title: 'Travel Preferences Study',
    description: 'A short study about how you plan holidays.',
    category: 'survey',
    rewardCents: 35,
    estMinutes: 3,
    logoColor: '#12A5B8',
  },
  {
    slug: 'bubble-blast-quest',
    title: 'Bubble Blast Quest',
    description: 'Clear level 12 to unlock the reward.',
    category: 'game',
    rewardCents: 100,
    estMinutes: 9,
    logoColor: '#D25A9C',
  },
];

/**
 * Real YouTube videos, each verified embeddable through the public oEmbed
 * endpoint (HTTP 200 = public AND the owner allows embedding) with the duration
 * read from its watch page. Live streams are excluded on purpose: they never
 * emit ENDED, so they cannot satisfy a completion rule.
 *
 * Replace these with videos you own or have licensed. Third-party embeds mean
 * Google receives a request from your users, which your privacy notice must
 * disclose; your own uploads avoid that entirely.
 *
 * If a video is later made unlisted, deleted or embed-blocked, the player
 * surfaces error 101/150 and the frontend drops it from rotation — update the
 * row here so the catalogue matches.
 */
const VIDEOS = [
  { youtubeId: 'aqz-KE-bpKQ', title: 'Big Buck Bunny 60fps 4K — Blender Foundation', seconds: 635, author: 'Blender' },
  { youtubeId: 'eRsGyueVLvQ', title: 'Sintel — Open Movie by Blender Foundation', seconds: 888, author: 'Blender' },
  { youtubeId: 'Y-rmzh0PI3c', title: 'Cosmos Laundromat — First Cycle', seconds: 731, author: 'Blender' },
  { youtubeId: 'WhWc3b3KhnY', title: 'Spring — Blender Open Movie', seconds: 464, author: 'Blender' },
  { youtubeId: 'sNhhvQGsMEc', title: 'The Fermi Paradox — Where Are All The Aliens?', seconds: 380, author: 'Kurzgesagt' },
  { youtubeId: 'LxgMdjyw8uw', title: 'We WILL Fix Climate Change!', seconds: 851, author: 'Kurzgesagt' },
  { youtubeId: 'uD4izuDMUQA', title: 'Timelapse of the Future: A Journey to the End of Time', seconds: 1761, author: 'melodysheep' },
  { youtubeId: '5MuIMqhT8DM', title: 'Sleep Is Your Superpower — Matt Walker', seconds: 1158, author: 'TED' },
  { youtubeId: 'arj7oStGLkU', title: 'Inside the Mind of a Master Procrastinator', seconds: 844, author: 'TED' },
  { youtubeId: 'hFZFjoX2cGg', title: 'Backyard Squirrel Maze 1.0 — Ninja Warrior Course', seconds: 1220, author: 'Mark Rober' },
  { youtubeId: 'jNQXAC9IVRw', title: 'Me at the zoo — the first video ever uploaded', seconds: 19, author: 'jawed' },
];

const REVIEWS = [
  { name: 'Marisol T.', country: 'ES', rating: 5, body: 'The task list is short and clear. I finished a survey on my commute and the reward showed up straight away.' },
  { name: 'Devon R.', country: 'US', rating: 4, body: 'Payout took a couple of days to clear review, but the checklist told me exactly what was pending.' },
  { name: 'Aiko N.', country: 'JP', rating: 5, body: 'I like that the app tells me how long a task takes before I start it.' },
  { name: 'Kwame B.', country: 'GH', rating: 4, body: 'Daily bonus and the video tasks are the easiest part. The dashboard shows everything I earned.' },
  { name: 'Lena K.', country: 'DE', rating: 5, body: 'Invite rewards are transparent — I can see exactly what each friend earned me.' },
  { name: 'Rafael M.', country: 'BR', rating: 4, body: 'Straightforward interface. Nothing hidden, no surprises on the cash-out page.' },
];

const ACTIVITY = [
  { name: 'j***n', country: 'US', cents: 5000 },
  { name: 'm***a', country: 'GB', cents: 2500 },
  { name: 'a***l', country: 'CA', cents: 1000 },
  { name: 's***i', country: 'AU', cents: 7500 },
  { name: 'k***o', country: 'JP', cents: 3000 },
  { name: 'd***e', country: 'DE', cents: 1500 },
  { name: 'n***h', country: 'ZA', cents: 4200 },
  { name: 'r***z', country: 'BR', cents: 2000 },
];

export function seed() {
  migrate();
  const db = getDb();

  const taskCount = (db.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c;
  if (taskCount === 0) {
    const insert = db.prepare(
      `INSERT INTO tasks (id, slug, title, description, category, reward_cents, est_minutes, offer_url, logo_color, provider, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?, 'mock', ?)`,
    );
    TASKS.forEach((t, i) => {
      insert.run(newId(), t.slug, t.title, t.description, t.category, t.rewardCents, t.estMinutes, `/offer/${t.slug}`, t.logoColor, i);
    });
    console.log(`[seed] ${TASKS.length} tasks`);
  }

  const videoCount = (db.prepare('SELECT COUNT(*) AS c FROM videos').get() as { c: number }).c;
  if (videoCount === 0) {
    const insert = db.prepare(
      `INSERT INTO videos (id, youtube_id, title, reward_cents, duration_seconds, sort_order, author)
       VALUES (?,?,?,?,?,?,?)`,
    );
    VIDEOS.forEach((v, i) => insert.run(newId(), v.youtubeId, v.title, 5, v.seconds, i, v.author));
    console.log(`[seed] ${VIDEOS.length} videos`);
  }

  const reviewCount = (db.prepare('SELECT COUNT(*) AS c FROM content_reviews').get() as { c: number }).c;
  if (reviewCount === 0) {
    const insert = db.prepare(
      `INSERT INTO content_reviews (id, masked_name, country_code, rating, body, verified, is_demo) VALUES (?,?,?,?,?,1,1)`,
    );
    for (const r of REVIEWS) insert.run(newId(), r.name, r.country, r.rating, r.body);
    console.log(`[seed] ${REVIEWS.length} demo reviews`);
  }

  const activityCount = (db.prepare('SELECT COUNT(*) AS c FROM activity_feed').get() as { c: number }).c;
  if (activityCount < 4) {
    const insert = db.prepare(
      `INSERT INTO activity_feed (id, masked_name, country_code, amount_cents, is_demo) VALUES (?,?,?,?,1)`,
    );
    ACTIVITY.forEach((a, i) => insert.run(newId(), a.name, a.country, a.cents));
    console.log(`[seed] ${ACTIVITY.length} demo activity entries`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  console.log('[seed] done');
}
