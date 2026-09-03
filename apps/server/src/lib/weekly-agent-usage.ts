/**
 * ISO-week bounds (UTC Monday 00:00 → next Monday) and percent for GAP-492.
 * Monthly Stripe / agent_task_usage cycle is unchanged.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** UTC Monday 00:00 of the ISO week containing `now`, and the following Monday. */
export function utcIsoWeekBounds(now: Date): { weekStart: Date; weekResetAt: Date } {
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = weekStart.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekResetAt = new Date(weekStart.getTime() + WEEK_MS);
  return { weekStart, weekResetAt };
}

/**
 * used/cap as a whole-number percent. `null` when there is no finite cap
 * (unlimited quota, missing meter, or zero allotment) so callers never
 * render a fake 0%.
 */
export function weeklyUsagePercent(weekUsed: number, quota: number): number | null {
  if (quota < 0 || quota === 0 || !Number.isFinite(quota)) return null;
  if (!Number.isFinite(weekUsed) || weekUsed <= 0) return 0;
  return Math.min(100, Math.round((weekUsed / quota) * 100));
}
