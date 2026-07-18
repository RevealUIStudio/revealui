/**
 * Lifecycle email copy — GAP-287 PR-1 discoverability.
 *
 * The day-7 outcome email for PAID tiers must surface the renewal path (the
 * refresh endpoint + the license page that carries the one-line command) so a
 * shortened-TTL key never strands a running instance. The free-tier email must
 * NOT carry it (no license key to refresh).
 */

import { describe, expect, it } from 'vitest';
import { buildDay7Outcome } from '../lifecycle-emails.js';

describe('buildDay7Outcome — renewal-path discoverability (GAP-287 PR-1)', () => {
  for (const tier of ['pro', 'max', 'enterprise'] as const) {
    it(`mentions the refresh endpoint and license page for a paid tier (${tier}), with agent actions`, () => {
      const { html, text } = buildDay7Outcome(tier, 5);
      expect(html).toContain('refresh endpoint');
      expect(html).toContain('/account/license');
      expect(text).toContain('refresh endpoint');
      expect(text).toContain('/account/license');
    });

    it(`mentions the refresh endpoint and license page for a paid tier (${tier}), zero-state`, () => {
      const { html, text } = buildDay7Outcome(tier, 0);
      expect(html).toContain('refresh endpoint');
      expect(text).toContain('/account/license');
    });
  }

  it('does NOT mention the refresh endpoint for the free tier', () => {
    const withActions = buildDay7Outcome('free', 3);
    const zeroState = buildDay7Outcome('free', 0);
    expect(withActions.html).not.toContain('refresh endpoint');
    expect(withActions.text).not.toContain('refresh endpoint');
    expect(zeroState.html).not.toContain('refresh endpoint');
    expect(zeroState.text).not.toContain('refresh endpoint');
  });

  it('contains no em dashes in the renewal copy (fleet hardline)', () => {
    const { html, text } = buildDay7Outcome('pro', 2);
    expect(html).not.toContain('—');
    expect(text).not.toContain('—');
  });
});
