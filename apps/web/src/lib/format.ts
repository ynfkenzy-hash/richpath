/** Display helpers. Money always arrives from the API as a USD number. */

export const money = (usd: number, opts: { signed?: boolean; currency?: boolean } = {}): string => {
  const { signed = false, currency = true } = opts;
  const value = Math.abs(usd);
  const formatted = currency
    ? `$${value.toFixed(2)}`
    : value.toFixed(2);
  if (!signed) return usd < 0 ? `-${formatted}` : formatted;
  return `${usd < 0 ? '-' : '+'}${formatted}`;
};

export const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(diffMs / 1000);
  if (seconds < 45) return 'just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0]!;
  for (const unit of units) {
    if (seconds >= unit[1]) chosen = unit;
  }
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  return rtf.format(-Math.round(seconds / chosen[1]), chosen[0]);
};

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const dateOnly = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

export const maskEmail = (email: string): string => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
};

export const countdown = (targetIso: string | null): string => {
  if (!targetIso) return '';
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};
