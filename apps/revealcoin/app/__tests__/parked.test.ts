/**
 * RevealCoin parked-state invariants.
 *
 * Per the 2026-05-08 charge-readiness audit (`~/revfleet/.jv/docs/audits/2026-05-08-charge-readiness-deep-audit.md`,
 * §5 Phase 4 Item 0.3), `apps/revealcoin/` must remain parked behind a single
 * notice page until the prerequisites listed in `app/lib/parked-config.ts`
 * land. These tests lock in:
 *
 *   1. The parking flag stays on (someone flipping it to `false` requires a
 *      conscious deliberate edit that re-runs all of these tests).
 *   2. The Q4-2026 anchor date isn't silently pushed back without an audit-doc
 *      update (we just assert the constant value; document updates land
 *      separately).
 */

import { describe, expect, it } from 'vitest';
import { REVEALCOIN_PARKED, REVEALCOIN_RESUME_TARGET } from '../lib/parked-config';
import { ParkedPage } from '../routes/ParkedPage';

describe('RevealCoin parking flag', () => {
  it('REVEALCOIN_PARKED defaults to true (do not flip without prerequisites)', () => {
    expect(REVEALCOIN_PARKED).toBe(true);
  });

  it('REVEALCOIN_RESUME_TARGET is the audit-anchored Q4-2026 date', () => {
    expect(REVEALCOIN_RESUME_TARGET).toBe('2026-Q4');
  });
});

describe('ParkedPage component', () => {
  it('exports a callable React component', () => {
    expect(typeof ParkedPage).toBe('function');
  });
});
