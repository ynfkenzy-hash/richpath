/**
 * ============================================================================
 *  FAQ CONTENT
 * ============================================================================
 *  Standard every answer here has to meet:
 *
 *   1. Verifiable. If an answer states a rule, it matches what the API
 *      enforces (see docs/04-database-api-requirements.md). Numbers mirror the
 *      defaults in apps/api/src/config.ts — update both together.
 *   2. Bounded. No income promises, no "guaranteed", no "risk-free", no
 *      headline earnings figure. Where supply is out of our hands (offers per
 *      country), say so.
 *   3. Specific about the limits. Minimums, cooldowns, caps and review
 *      windows are stated plainly rather than left vague.
 *   4. Useful against fraud, not just reassuring. Tell people what we will
 *      never ask for and what a scam looks like, including when it imitates us.
 *   5. Honest about this build. The demonstration is labelled as such wherever
 *      it could otherwise read as a real payout promise.
 *
 *  LANDING_FAQ is the subset shown on the marketing page: the questions that
 *  decide whether a rewards platform can be trusted. FAQ_ITEMS is everything,
 *  used by the FAQ page.
 * ============================================================================
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'How much can I actually earn here?',
    a: 'Rewards are small and fixed per activity: a video view pays a few cents, an offer pays a few cents to a few dollars, a daily claim pays cents. What you actually get depends on how many offers are genuinely available for your country and device, which is not something we control, so treat this as pocket money rather than a wage. The user and payout totals on the home page are clearly labelled sample figures, not claims about results.',
  },
  {
    q: 'Do I have to pay anything to join, or to withdraw?',
    a: 'No. Joining is free, there is no subscription or upgrade, and no fee is taken from your balance when you withdraw. You must be 18 or over, and any tax on what you receive is your own responsibility. Any rewards site that asks you to deposit money, pay a joining fee or buy credits to unlock a payout is a scam: there is never a legitimate reason to charge someone for money they have already earned.',
  },
  {
    q: 'What exactly do I need before I can cash out?',
    a: 'Three things, shown as a live checklist on the Cash-out page: 3 credited tasks, a saved payout method (bank card or USDT wallet), and a balance at or above the published minimum. Meeting them does not pay you instantly — the request goes into review and your balance is held while it is checked. One request can be open at a time, and a payout destination already used by another account is rejected.',
  },
  {
    q: 'When will the money actually arrive?',
    a: 'Not in the same second you ask, and anyone promising instant payout is hiding something. Every request moves through three states you can watch on the Records page: Pending (received, balance held), Under review (we check the offers behind it), and Paid (sent to your saved method). The review is what catches duplicate accounts and reversed offers — the things that make payouts unreliable for everyone else. If something needs more information we contact you rather than quietly holding the request, and if a request is still under review after 7 days you should quote its date to support.',
  },
  {
    q: 'Why was my reward not credited — and do I lose money I already earned?',
    a: 'The usual causes: the offer expects a genuinely new user of that product, you had already completed it, a VPN or emulator was in use, you finished before the minimum engagement time, or the advertiser rejected the conversion. What does not happen: a failed or reversed offer never removes money you already earned legitimately — only that single reward is affected. If a credit looks missing, send support the task or video name and the date and it can be traced line by line.',
  },
  {
    q: 'Do I have to invite people to get paid?',
    a: 'No, and you should walk away from any platform where you do. Making withdrawal conditional on recruiting new members is the defining feature of an illegal pyramid scheme, and no legitimate reward programme needs it. Invites here are optional and pay a bonus when a friend signs up, plus a share of what they earn from their own activity. Your payout never depends on anyone else joining.',
  },
  {
    q: 'How long do I have to watch a video, and how is that measured?',
    // Numbers mirror the API defaults: VIDEO_MIN_PLAYBACK_SECONDS=20, video daily
    // cap 10 (+3 after 3 credited tasks), TASK_MIN_ENGAGEMENT_SECONDS=20, 24h task
    // cooldown. Update this answer whenever those defaults change.
    a: 'A video reward needs real playback of the shorter of 20 seconds or 90% of the video, counted only while the player reports that it is actually playing. It is not a wall-clock timer: leaving the tab, muting and walking away, or blocking the player does not count, and the figure is re-checked against the video’s known length before a cent is credited. Tasks work the same way — the offer has to be genuinely completed, plus a 20-second minimum engagement window, and each task refreshes after a 24-hour cooldown. The daily list is 10 videos, plus 3 extra once you have 3 credited tasks.',
  },
  {
    q: 'Can I use a VPN, an emulator, or a second account?',
    a: 'No. Advertisers pay only for offers that reach real users in the countries those offers were sold for, so VPN and proxy traffic is detected, and duplicate accounts and shared payout destinations are removed during review. We would rather tell you that up front than reverse a payout after you have earned it. One account, your own device, your own country.',
  },
  {
    q: 'Sometimes there are no offers for me at all. Why?',
    a: 'Because offers are supplied per country, device and advertising budget, and they run out. There is no queue we can conjure tasks from, and showing invented tasks just to keep you on the page is not something we do — the daily streak, the video list and your existing balance keep working either way, and short surveys are usually the most consistently available. If nothing appears for days, your region may simply not be covered by the advertisers, and that is worth knowing before you spend much time here.',
  },
  {
    q: 'What will you never ask me for?',
    a: 'Your password, a one-time code sent by SMS or email, or a payment to release a withdrawal. Passwords are stored as bcrypt hashes that nobody can read back, the session is a single httpOnly cookie, and payout destinations are kept masked plus hashed so support can recognise one without ever seeing it. Anyone who asks you for those things is attacking your account, even if the message looks like it came from us.',
  },
  {
    q: 'Something looks wrong — who do I contact, and what should I send?',
    // {{support}} is substituted with VITE_SUPPORT_EMAIL by FaqPage, so the
    // address is configured in exactly one place.
    a: 'Email {{support}}. Include your account email, the name of the task or video, the date, and what you expected to see; that is usually everything needed to trace a credit or follow a payout. Support answers missing credits, review windows and payout status, and aims to reply within two working days. Never put your password or a one-time code in a support message — no member of staff needs either, and any message asking for them is not from us.',
  },
];

/** The six that matter most for trust — shown on the landing page. */
export const LANDING_FAQ = FAQ_ITEMS.slice(0, 6);
