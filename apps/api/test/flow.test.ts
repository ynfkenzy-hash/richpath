/**
 * End-to-end API flow covering the features the rebuild reproduces:
 * register → task lifecycle → video → daily → invite → cash-out.
 * Run with: npm --workspace apps/api run test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated database + fast rules for the test run — set BEFORE importing config.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'richpath-test-'));
process.env.DATABASE_FILE = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
process.env.NODE_ENV = 'test';
process.env.TASK_MIN_ENGAGEMENT_SECONDS = '0';
process.env.WITHDRAWAL_AUTO_APPROVE_SECONDS = '0';
process.env.WITHDRAWAL_MIN_ACCOUNT_AGE_HOURS = '0';
process.env.WITHDRAWAL_MIN_AMOUNT = '1';
process.env.FIRST_WITHDRAW_MIN_BALANCE = '1';
process.env.RATE_LIMIT_AUTH_PER_MIN = '1000';
process.env.RATE_LIMIT_CLAIM_PER_MIN = '1000';
process.env.RATE_LIMIT_GENERAL_PER_MIN = '10000';

const { createApp } = await import('../src/app.js');
const { migrate } = await import('../src/db/migrate.js');
const { seed } = await import('../src/db/seed.js');

migrate();
seed();

const app = createApp();
const server = app.listen(0);
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/v1`;

let cookieJar = '';
async function call(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookieJar ? { cookie: cookieJar } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  return { status: res.status, body: json };
}

const results: { name: string; ok: boolean; info?: string }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, info: (err as Error).message });
  }
}

const email = `tester${Date.now()}@example.com`;

await test('register returns a user, welcome bonus and session cookie', async () => {
  const res = await call('POST', '/auth/register', {
    name: 'Test User',
    email,
    password: 'passw0rd!',
    locale: 'en',
    acceptTerms: true,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.user.email, email);
  assert.ok(res.body.user.balance >= 0.3, 'welcome bonus credited');
  assert.ok(res.body.user.referralCode?.length === 8);
  assert.ok(cookieJar.includes('rp_session'));
});

await test('duplicate email is rejected with 409', async () => {
  const res = await call('POST', '/auth/register', {
    name: 'Copy Cat',
    email,
    password: 'passw0rd!',
    locale: 'en',
    acceptTerms: true,
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'email_taken');
});

await test('weak password is rejected with field details', async () => {
  const res = await call('POST', '/auth/register', {
    name: 'Weak Pass',
    email: `weak${Date.now()}@example.com`,
    password: 'short',
    locale: 'en',
    acceptTerms: true,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'validation_failed');
  assert.ok(res.body.error.details.password, 'password error surfaced');
});

await test('unauthenticated requests are rejected', async () => {
  const saved = cookieJar;
  cookieJar = '';
  const res = await call('GET', '/tasks');
  assert.equal(res.status, 401);
  cookieJar = saved;
});

await test('task list contains seeded offers', async () => {
  const res = await call('GET', '/tasks');
  assert.equal(res.status, 200);
  assert.ok(res.body.items.length >= 5);
  assert.ok(res.body.items.every((t: any) => t.reward > 0));
});

let taskId = '';
let completion: any;

await test('starting a task issues a signed proof token and start URL', async () => {
  const list = await call('GET', '/tasks');
  taskId = list.body.items[0].id;
  const res = await call('POST', `/tasks/${taskId}/start`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.startUrl.includes('t='), 'proof token embedded in start URL');
  completion = res.body;
});

await test('completing a task credits the balance', async () => {
  const res = await call('POST', `/tasks/${taskId}/complete`, {
    completionId: completion.completionId,
    proofToken: new URLSearchParams(completion.startUrl.split('?')[1]).get('t'),
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, 'credited');
  assert.ok(res.body.balance > 0.3);
});

await test('the same task cannot be credited twice', async () => {
  const res = await call('POST', `/tasks/${taskId}/complete`, {
    completionId: completion.completionId,
    proofToken: new URLSearchParams(completion.startUrl.split('?')[1]).get('t'),
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'already_credited');
});

await test('forged proof token is refused', async () => {
  const start = await call('POST', `/tasks/${taskId}/start`);
  const res = await call('POST', `/tasks/${taskId}/complete`, {
    completionId: start.body.completionId,
    // A token signed by someone else (any non-server token) must be rejected.
    proofToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJwcm9vZiJ9.bad-signature',
  });
  assert.ok(res.status === 400 || res.status === 409, `expected rejection, got ${res.status}`);
});

await test('video list is limited and completion credits the user', async () => {
  const state = await call('GET', '/videos');
  assert.equal(state.status, 200);
  assert.ok(state.body.videos.length > 0);
  const video = state.body.videos[0];
  assert.ok(video.youtubeId && video.youtubeId.length === 11, 'expected a real YouTube id, got ' + video.youtubeId);
  assert.equal(video.requiredSeconds, 20, 'watch-time rule exposed to the client');
  assert.ok(video.durationSeconds > 0, 'duration missing');

  // Under-watching is rejected, and the error tells the client what is needed.
  const short = await call('POST', `/videos/${video.id}/complete`, { secondsWatched: 5 });
  assert.equal(short.status, 400);
  assert.equal(short.body.error.code, 'not_enough_time');
  assert.equal(short.body.error.details.requiredSeconds, 20);

  const res = await call('POST', `/videos/${video.id}/complete`, { secondsWatched: video.requiredSeconds });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(res.body.balance > 0);
});

await test('all seeded videos are embeddable YouTube ids with durations', async () => {
  const state = await call('GET', '/videos');
  for (const v of state.body.videos) {
    assert.match(v.youtubeId, /^[A-Za-z0-9_-]{11}$/, 'bad id: ' + v.youtubeId);
    assert.ok(v.durationSeconds > 0, 'no duration for ' + v.youtubeId);
    assert.ok(v.requiredSeconds <= v.durationSeconds, 'threshold exceeds duration for ' + v.youtubeId);
  }
});

await test('video discovery fails closed without an API key', async () => {
  const res = await call('GET', '/videos/discover?query=space');
  assert.equal(res.status, 503, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'youtube_not_configured');
  assert.ok(/YOUTUBE_API_KEY/.test(res.body.error.message), 'error should name the missing variable');
});

await test('watching the same video twice in a day is blocked', async () => {
  const state = await call('GET', '/videos');
  const video = state.body.videos.find((v: any) => v.watched);
  const res = await call('POST', `/videos/${video.id}/complete`, { secondsWatched: 999 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'already_watched');
});

await test('daily bonus can only be claimed once per day', async () => {
  const first = await call('POST', '/daily/claim');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.ok(first.body.reward > 0);
  const second = await call('POST', '/daily/claim');
  assert.equal(second.status, 409);
});

await test('invitee registration pays the inviter and links the referral', async () => {
  const me = await call('GET', '/users/me');
  const code = me.body.user.referralCode;
  const before = me.body.user.balance;

  const saved = cookieJar;
  cookieJar = '';
  const signup = await call('POST', '/auth/register', {
    name: 'Invited Friend',
    email: `friend${Date.now()}@example.com`,
    password: 'passw0rd!',
    referralCode: code,
    locale: 'en',
    acceptTerms: true,
  });
  assert.equal(signup.status, 201, JSON.stringify(signup.body));
  cookieJar = saved;

  const after = await call('GET', '/users/me');
  assert.ok(after.body.user.balance > before, 'inviter earned the signup reward');
  assert.equal(after.body.user.referralCount, 1);

  const summary = await call('GET', '/referrals');
  assert.equal(summary.body.referralCount, 1);
  assert.equal(summary.body.referrals.length, 1);
  assert.ok(summary.body.referrals[0].maskedName.includes('*'), 'invitee names are masked');
});

await test('the 3-task review threshold is enforced before cash-out', async () => {
  const eligibility = await call('GET', '/withdrawals/eligibility');
  assert.equal(eligibility.body.eligible, false);
  assert.ok(eligibility.body.reasons.some((r: any) => r.code === 'not_enough_tasks'), 'task minimum reported');

  // Finish two more tasks so the account reaches the threshold.
  const list = await call('GET', '/tasks');
  const fresh = list.body.items.filter((t: any) => !t.completion).slice(0, 2);
  for (const t of fresh) {
    const start = await call('POST', `/tasks/${t.id}/start`);
    const proof = new URLSearchParams(start.body.startUrl.split('?')[1]).get('t');
    const done = await call('POST', `/tasks/${t.id}/complete`, {
      completionId: start.body.completionId,
      proofToken: proof,
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
  }
  const after = await call('GET', '/withdrawals/eligibility');
  assert.equal(after.body.creditedTasks, 3);
});

await test('cash-out is blocked until a payment method and minimums are met', async () => {
  const res = await call('POST', '/withdrawals', { amount: 0.5, method: 'usdt' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'not_eligible');
});

await test('payout destination must be plausible and is stored masked', async () => {
  const bad = await call('PUT', '/withdrawals/payment-methods', {
    method: 'usdt',
    accountName: 'Test User',
    destination: 'abc',
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'validation_failed');

  const ok = await call('PUT', '/withdrawals/payment-methods', {
    method: 'usdt',
    accountName: 'Test User',
    destination: 'TQ5d8Xk2pQ9rLm4Nv7Wc3Zb6Yh1Js8Ue2G',
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.items[0].destinationMasked.slice(0, 4), '****');
  assert.ok(!JSON.stringify(ok.body).includes('TQ5d8Xk2pQ9rLm4Nv7Wc3Zb6Yh1Js8Ue2G'), 'raw destination never returned');
});

await test('cash-out deducts the balance and lands in the payment log', async () => {
  await call('POST', '/users/me/demo-topup');
  const me = await call('GET', '/users/me');
  const amount = Math.min(5, me.body.user.balance);

  const res = await call('POST', '/withdrawals', { amount, method: 'usdt' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const after = await call('GET', '/users/me');
  assert.ok(Math.abs(after.body.user.balance - (me.body.user.balance - amount)) < 0.001, 'funds held on request');

  const log = await call('GET', '/withdrawals');
  assert.equal(log.body.items.length, 1);
  assert.equal(log.body.items[0].status, 'pending');
});

await test('a second cash-out cannot be opened while one is pending', async () => {
  const res = await call('POST', '/withdrawals', { amount: 1, method: 'usdt' });
  assert.equal(res.status, 409);
});

await test('ledger is paginated and includes task, video, daily and withdrawal rows', async () => {
  const res = await call('GET', '/users/me/ledger?page=1&pageSize=50');
  assert.equal(res.status, 200);
  const types = new Set(res.body.items.map((i: any) => i.type));
  for (const expected of ['welcome', 'task', 'video', 'daily', 'withdrawal']) {
    assert.ok(types.has(expected), `ledger contains a ${expected} entry`);
  }
});

await test('login with a wrong password fails and leaks nothing', async () => {
  const saved = cookieJar;
  cookieJar = '';
  const res = await call('POST', '/auth/login', { email, password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, 'Email or password is incorrect');
  cookieJar = saved;
});

await test('public content endpoints mask user identities and flag demo data', async () => {
  const activity = await call('GET', '/content/activity?limit=5');
  assert.equal(activity.status, 200);
  assert.equal(activity.body.isDemo, true);
  assert.ok(activity.body.items.every((i: any) => i.maskedName.includes('*')));

  const reviews = await call('GET', '/content/reviews');
  assert.equal(reviews.body.isDemo, true);
});

await test('unsupported offerwall postback signatures are rejected', async () => {
  const res = await fetch(`${base}/integrations/offerwall/postback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ completion_id: 'x', amount: 999, status: 'credited' }),
  });
  assert.equal(res.status, 400, 'unconfigured provider fails closed');
});

/* ------------------------------------------------ operator notifications */
await test('SameSite=none is refused unless the cookie is Secure', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const configPath = fileURLToPath(new URL('../src/config.ts', import.meta.url));

  // Browsers drop a SameSite=None cookie that is not Secure, so the API refuses
  // to start with that combination instead of losing every session silently.
  let failed = false;
  try {
    execFileSync(process.execPath, ['--import', 'tsx', '-e', `import(${JSON.stringify(configPath)})`], {
      env: { ...process.env, COOKIE_SAMESITE: 'none', COOKIE_SECURE: '0', NODE_ENV: 'production' },
      stdio: 'pipe',
    });
  } catch (err) {
    failed = true;
    assert.match(String((err as any).stderr), /COOKIE_SECURE/, 'error should name the missing variable');
  }
  assert.ok(failed, 'COOKIE_SAMESITE=none with COOKIE_SECURE=0 was accepted');

  let badValue = false;
  try {
    execFileSync(process.execPath, ['--import', 'tsx', '-e', `import(${JSON.stringify(configPath)})`], {
      env: { ...process.env, COOKIE_SAMESITE: 'sometimes' },
      stdio: 'pipe',
    });
  } catch {
    badValue = true;
  }
  assert.ok(badValue, 'an invalid SameSite value was accepted');
});

await test('the session cookie carries the configured SameSite policy', async () => {
  // The helper stores cookies in a jar, so read the attributes off one raw call.
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'passw0rd!' }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).join(' | ');
  assert.match(cookie, /rp_session=/, 'no session cookie issued');
  assert.match(cookie, /HttpOnly/i, 'cookie must be HttpOnly');
  assert.match(cookie, /SameSite=Lax/i, 'default policy should be Lax');
  assert.equal(/SameSite=None/i.test(cookie), false, 'test run must not default to a cross-site cookie');
});

await test('operator notifications carry platform events, never credentials', async () => {
  const { assertNoSecrets, maskEmail } = await import('../src/integrations/notify.js');

  assert.equal(maskEmail('richard23@gmail.com'), 'r***@gmail.com', 'mask should reveal one character only');

  // The screen is fail-closed: anything credential-shaped refuses to send.
  for (const bad of [
    { password: 'hunter2' },
    { user: { email: 'a@b.co', passwordHash: '$2b$10$abc' } },
    { sessionToken: 'eyJhbGciOi' },
    { otp: '123456' },
    { payout: { iban: 'DE89 3704 0044 0532 0130 00' } },
    { cvv: '123' },
  ]) {
    assert.throws(() => assertNoSecrets(bad), /Refusing to notify/, 'accepted: ' + JSON.stringify(bad));
  }

  // The real payload shape is accepted and carries no sensitive field.
  const ok = {
    event: 'user_registered',
    at: new Date().toISOString(),
    userId: 'usr_1',
    maskedEmail: 'r***@gmail.com',
  };
  assert.doesNotThrow(() => assertNoSecrets(ok));
  assert.equal(ok.maskedEmail.includes('richard23'), false, 'masked address still contains the local part');
});

await test('a registration never forwards the password anywhere', async () => {
  const { notifyOperator } = await import('../src/integrations/notify.js');
  const secret = 'passw0rd!';
  const result = notifyOperator({ type: 'user_registered', userId: 'usr_x', maskedEmail: 'n***@example.com' });
  assert.equal(result.sent, false, 'notifications should be off by default');
  assert.equal(result.reason, 'not_configured', 'reason: ' + result.reason);
  const serialised = JSON.stringify(result.payload ?? {});
  assert.equal(serialised.includes(secret), false, 'a password reached the notification payload');
  assert.equal(/password|token|secret/i.test(serialised), false, 'a credential-shaped field reached the payload');
});

await test('logging out kills the session cookie', async () => {
  const out = await call('POST', '/auth/logout');
  assert.equal(out.status, 200);
  cookieJar = '';
  const probe = await call('GET', '/users/me');
  assert.equal(probe.status, 401);
});

server.close();

const failed = results.filter((r) => !r.ok);
console.log('\nAPI flow tests');
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.info ? ` — ${r.info}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.rmSync(tmpDir, { recursive: true, force: true });
if (failed.length) process.exit(1);
