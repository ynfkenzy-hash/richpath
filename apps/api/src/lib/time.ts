/**
 * SQLite stores datetimes as 'YYYY-MM-DD HH:MM:SS' in UTC. JavaScript parses
 * that string as LOCAL time, which silently shifts every duration calculation
 * by the server's offset. Always run timestamps through this helper first.
 */
export function sqliteUtcToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalised = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  return new Date(normalised).toISOString();
}

export function secondsSince(value: string): number {
  const iso = sqliteUtcToIso(value);
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 1000;
}

/** Current UTC date as YYYY-MM-DD — the unit of "a day" for daily rewards. */
export const utcDate = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

export const yesterdayUtc = (): string => utcDate(new Date(Date.now() - 86_400_000));
