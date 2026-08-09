/**
 * GAP-256 PR-2 — pure period-date helpers for margin snapshots.
 */

/** UTC calendar date YYYY-MM-DD. Default: previous complete UTC day. */
export function defaultPeriodDateUtc(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return d.toISOString().slice(0, 10);
}

export function periodDayBoundsUtc(periodDate: string): {
  start: Date;
  end: Date;
  asDate: Date;
} {
  const [y, m, day] = periodDate.split('-').map(Number);
  const start = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (day ?? 1) + 1, 0, 0, 0, 0));
  return { start, end, asDate: start };
}
