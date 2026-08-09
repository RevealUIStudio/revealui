/**
 * GAP-256 PR-2 — HC14: flag gates snapshot writes (pure gate check).
 */
import { describe, expect, it } from 'vitest';

/** Mirrors runMarginSnapshot early return (keep in lockstep with margin-snapshot-run). */
function isSnapshotCronEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.MARGIN_SNAPSHOT_CRON_ENABLED === 'true';
}

describe('MARGIN_SNAPSHOT_CRON_ENABLED gate (HC14)', () => {
  it('is off by default / false', () => {
    expect(isSnapshotCronEnabled({})).toBe(false);
    expect(isSnapshotCronEnabled({ MARGIN_SNAPSHOT_CRON_ENABLED: 'false' })).toBe(false);
  });

  it('is on only when exactly true', () => {
    expect(isSnapshotCronEnabled({ MARGIN_SNAPSHOT_CRON_ENABLED: 'true' })).toBe(true);
    expect(isSnapshotCronEnabled({ MARGIN_SNAPSHOT_CRON_ENABLED: '1' })).toBe(false);
  });
});
