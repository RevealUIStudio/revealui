import { describe, expect, it } from 'vitest';
import { classifyMigrationDrift } from '../backfill-migrations.ts';

/** Build journal entries from a list of `when` timestamps. */
function j(...whens: number[]): Array<{ tag: string; when: number }> {
  return whens.map((when, i) => ({ tag: `${String(i).padStart(4, '0')}_m`, when }));
}

describe('classifyMigrationDrift', () => {
  it('is synced when tracking matches the journal whens', () => {
    expect(classifyMigrationDrift([1, 2, 3], j(1, 2, 3))).toEqual({ kind: 'synced' });
  });

  it('is pending when the only un-tracked entry is newer than all applied (the 0016 case)', () => {
    const r = classifyMigrationDrift([1, 2, 3], j(1, 2, 3, 4));
    expect(r.kind).toBe('pending');
    expect(r).toMatchObject({ pendingTags: ['0003_m'] });
  });

  it('is pending for a multi-entry tail of new migrations', () => {
    const r = classifyMigrationDrift([1, 2], j(1, 2, 3, 4));
    expect(r).toMatchObject({ kind: 'pending', pendingTags: ['0002_m', '0003_m'] });
  });

  it('is drift when a tracking row is missing for a migration OLDER than the newest applied', () => {
    // journal whens 1,2,3 ; tracked 1,3 -> missing when=2 (< maxTracked 3) = 2026-04-20 class
    expect(classifyMigrationDrift([1, 3], j(1, 2, 3)).kind).toBe('drift');
  });

  it('is drift when tracking has a row absent from the journal (orphan)', () => {
    expect(classifyMigrationDrift([1, 999], j(1)).kind).toBe('drift');
  });

  it('treats an empty tracking table with pending journal entries as pending', () => {
    expect(classifyMigrationDrift([], j(1, 2)).kind).toBe('pending');
  });

  it('classifies the real 0016 scenario (0000+0015 tracked, 0016 pending) as pending — not drift', () => {
    const tracked = [1776048529577, 1777425244909]; // 0000_init + 0015 (newest applied)
    const journal = [
      { tag: '0000_init', when: 1776048529577 },
      { tag: '0015_users_stripe_deletion_status', when: 1777425244909 },
      { tag: '0016_drop_revealcoin_tables', when: 1779431687726 },
    ];
    const r = classifyMigrationDrift(tracked, journal);
    expect(r).toMatchObject({ kind: 'pending', pendingTags: ['0016_drop_revealcoin_tables'] });
  });
});
