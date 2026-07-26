import { describe, expect, it } from 'vitest';
import { CHARGEABLE_EVENTS } from '../pricing.config.js';

// Pins the owner-ruled 2026-07-26 launch prices (GAP-431). If this test needs
// to change, a price actually changed -- update business/offerings-canonical.md
// in the coordination repo in the same change, per README.md.
describe('CHARGEABLE_EVENTS', () => {
  it('matches the owner-ruled launch prices', () => {
    expect(CHARGEABLE_EVENTS.governedAction).toMatchObject({
      name: 'governed-action',
      priceUsd: 0.02,
    });
    expect(CHARGEABLE_EVENTS.runCompleted).toMatchObject({ name: 'run-completed', priceUsd: 0.08 });
    expect(CHARGEABLE_EVENTS.receiptVerification).toMatchObject({
      name: 'receipt-verification',
      priceUsd: 0,
    });
  });

  it('has a unique event name per entry', () => {
    const names = Object.values(CHARGEABLE_EVENTS).map((event) => event.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
