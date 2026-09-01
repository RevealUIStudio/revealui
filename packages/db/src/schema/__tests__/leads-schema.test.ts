/**
 * Schema shape lock for the studio leads table.
 * Admin collection + contact-form insert land in the same change.
 */
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { LEAD_SOURCES, LEAD_STATUSES, leads } from '../leads.js';

describe('studio leads schema', () => {
  it('exposes expected columns', () => {
    const cols = Object.keys(leads);
    for (const key of [
      'id',
      'name',
      'email',
      'company',
      'source',
      'status',
      'notes',
      'introAt',
      'createdAt',
      'updatedAt',
    ]) {
      expect(cols).toContain(key);
    }
  });

  it('table name matches the admin collection slug', () => {
    expect(getTableName(leads)).toBe('leads');
  });

  it('locks pipeline status and source enums', () => {
    expect(LEAD_STATUSES).toEqual([
      'lead',
      'intro_booked',
      'intro_done',
      'pilot',
      'launch',
      'closed',
    ]);
    expect(LEAD_SOURCES).toEqual(['agency', 'marketing', 'manual']);
  });
});
