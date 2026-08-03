/**
 * Schema shape lock for GAP-448 Phase 2 kit_fulfillments.
 * Handler + webhook enqueue land in later PRs (P2-2 / P2-3).
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
      'branding',
      'artifactUri',
      'error',
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
