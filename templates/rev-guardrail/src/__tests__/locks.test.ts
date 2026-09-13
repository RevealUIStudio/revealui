import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadLocks, parseLocks } from '../locks.js';

const EXAMPLE = join(dirname(fileURLToPath(import.meta.url)), '../../locks.example.json');

describe('REV Guardrail lock file', () => {
  it('ships non-empty cash ladder, required snapshot, deny-list, and allowlisted verbs', () => {
    const locks = loadLocks(EXAMPLE);
    expect(locks.cash_ladder.consultation.price_usd).toBe(300);
    expect(locks.cash_ladder.pilot.price_usd).toBe(1500);
    expect(locks.cash_ladder.launch.price_usd).toBe(7500);
    expect(locks.snapshot_before_checkpoint).toBe('required');
    expect(locks.overclaim.deny_patterns.length).toBeGreaterThan(0);
    expect(locks.overclaim.vendor_soc2_allow_patterns.length).toBeGreaterThan(0);
    expect(locks.overclaim.empty_deny_list).toBe('warn');
    expect(locks.banned_icp_phrases.mode).toBe('optional');
    expect(locks.banned_icp_phrases.soft_list).toContain('Fortune 500 theater');
    expect(locks.enforcement_verbs).toEqual([
      'block_publish',
      'require_snapshot',
      'refuse_overclaim',
      'needs_human',
    ]);
  });

  it('rejects unknown public-template flags such as force-publish', () => {
    const locks = loadLocks(EXAMPLE);
    expect(() => parseLocks({ ...locks, force_publish: true })).toThrow();
    expect(() => parseLocks({ ...locks, admin_bypass: true })).toThrow();
  });
});
