import { describe, expect, it } from 'vitest';
import { PageSchema, UpdatePageInputSchema } from '../../entities/page.js';

// Regression for revealui#1639: the contracts Page field for scheduled-publish
// time is named `scheduledAt`, matching the db column `scheduled_at`
// (packages/db/src/schema/pages.ts). The field used to be named `publishAt`,
// which never lined up with the db column, so a db row's scheduled-publish value
// was silently dropped on a key-based round-trip through the contract layer.

const SCHEDULED_AT = '2026-07-01T12:00:00.000Z';

// Shaped like a db row → contract bridge would hand to PageSchema.parse(),
// using the db (drizzle) property name `scheduledAt`.
const dbShapedPage = {
  id: 'page_123',
  siteId: 'site_123',
  title: 'Launch Announcement',
  slug: 'launch-announcement',
  path: '/launch-announcement',
  status: 'scheduled' as const,
  blocks: [],
  scheduledAt: SCHEDULED_AT,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('PageSchema scheduledAt (revealui#1639)', () => {
  it('round-trips scheduledAt from a db-shaped row without dropping it', () => {
    const parsed = PageSchema.parse(dbShapedPage);
    expect(parsed.scheduledAt).toBe(SCHEDULED_AT);
  });

  it('treats the legacy publishAt key as unknown (stripped, not mapped)', () => {
    const { scheduledAt, ...withoutScheduled } = dbShapedPage;
    const legacy = { ...withoutScheduled, publishAt: SCHEDULED_AT } as Record<string, unknown>;
    const parsed = PageSchema.parse(legacy);
    // The renamed schema no longer carries the scheduled-publish value under the
    // old key, and Zod strips the unknown `publishAt` — proving the old name was
    // exactly the round-trip drift.
    expect(parsed.scheduledAt).toBeUndefined();
    expect('publishAt' in parsed).toBe(false);
  });

  it('allows scheduledAt to be omitted (optional)', () => {
    const { scheduledAt, ...withoutScheduled } = dbShapedPage;
    const parsed = PageSchema.parse(withoutScheduled);
    expect(parsed.scheduledAt).toBeUndefined();
  });
});

describe('UpdatePageInputSchema scheduledAt (revealui#1639)', () => {
  it('accepts scheduledAt on update input', () => {
    const parsed = UpdatePageInputSchema.parse({ scheduledAt: SCHEDULED_AT });
    expect(parsed.scheduledAt).toBe(SCHEDULED_AT);
  });
});
