/**
 * Schema shape lock for GAP-448 Phase 2 kit_fulfillments (P2-1 base + P2-A columns).
 */
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { kitFulfillments } from '../kit-fulfillments.js';

describe('GAP-448 kit_fulfillments schema', () => {
  it('exposes expected columns', () => {
    const cols = Object.keys(kitFulfillments);
    for (const key of [
      'id',
      'stripeEventId',
      'licenseId',
      'userId',
      'customerId',
      'tier',
      'status',
      'artifactMode',
      'branding',
      'artifact',
      'error',
      'livemode',
      'createdAt',
      'updatedAt',
    ]) {
      expect(cols).toContain(key);
    }
  });

  it('table name is stable for migrations', () => {
    expect(getTableName(kitFulfillments)).toBe('kit_fulfillments');
  });
});
