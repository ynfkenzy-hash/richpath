/**
 * All money lives in integer cents. Cents <-> dollars conversion happens only
 * at the API boundary so the UI never sees float rounding noise.
 */
export const usd = (cents: number): number => Math.round(cents) / 100;
export const cents = (dollars: number): number => Math.round(dollars * 100);

/** Format a signed amount for ledger descriptions, e.g. "+$0.25". */
export const signed = (centsValue: number): string =>
  `${centsValue < 0 ? '-' : '+'}$${(Math.abs(centsValue) / 100).toFixed(2)}`;
