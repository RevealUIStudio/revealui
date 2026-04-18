/**
 * Integration tests  -  sites.page_count DB trigger (GAP-012)
 *
 * Uses PGlite (in-memory PostgreSQL) to verify that the trigger function
 * correctly maintains sites.page_count on page INSERT and soft-delete UPDATE.
 * No application-level counter calls are involved: the trigger alone must
 * keep the count accurate.
 */

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();

  // Minimal sites + pages schema (matches production column names)
  await db.query(`
    CREATE TABLE sites (
      id         TEXT PRIMARY KEY,
      page_count INTEGER DEFAULT 0
    )
  `);

  await db.query(`
    CREATE TABLE pages (
      id         TEXT PRIMARY KEY,
      site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      deleted_at TIMESTAMPTZ
    )
  `);

  // Install the trigger function + trigger (mirrors 0002_triggers_search_vectors.sql)
  await db.query(`
    CREATE OR REPLACE FUNCTION page_count_trigger_fn()
    RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        IF NEW.deleted_at IS NULL THEN
          UPDATE sites
            SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
            WHERE id = NEW.site_id;
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
          UPDATE sites
            SET page_count = GREATEST(COALESCE(page_count, 0) - 1, 0)
            WHERE id = NEW.site_id;
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
          UPDATE sites
            SET page_count = GREATEST(COALESCE(page_count, 0) + 1, 0)
            WHERE id = NEW.site_id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$
  `);

  await db.query(`
    CREATE TRIGGER page_count_trigger
      AFTER INSERT OR UPDATE ON pages
      FOR EACH ROW
      EXECUTE FUNCTION page_count_trigger_fn()
  `);
}, 30_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.query('DELETE FROM pages');
  await db.query('DELETE FROM sites');
  await db.query(`INSERT INTO sites (id, page_count) VALUES ('s1', 0)`);
});

function getPageCount(): Promise<number> {
  return db
    .query<{ page_count: number }>(`SELECT page_count FROM sites WHERE id = 's1'`)
    .then((r) => r.rows[0]?.page_count ?? 0);
}

describe('page_count_trigger', () => {
  it('increments page_count when an active page is inserted', async () => {
    await db.query(`INSERT INTO pages (id, site_id) VALUES ('p1', 's1')`);
    expect(await getPageCount()).toBe(1);
  });

  it('does not increment when a page is inserted already soft-deleted', async () => {
    await db.query(`INSERT INTO pages (id, site_id, deleted_at) VALUES ('p1', 's1', NOW())`);
    expect(await getPageCount()).toBe(0);
  });

  it('decrements page_count when a page is soft-deleted', async () => {
    await db.query(`INSERT INTO pages (id, site_id) VALUES ('p1', 's1')`);
    expect(await getPageCount()).toBe(1);

    await db.query(`UPDATE pages SET deleted_at = NOW() WHERE id = 'p1'`);
    expect(await getPageCount()).toBe(0);
  });

  it('does not go below zero on double soft-delete attempt', async () => {
    await db.query(`INSERT INTO pages (id, site_id) VALUES ('p1', 's1')`);
    await db.query(`UPDATE pages SET deleted_at = NOW() WHERE id = 'p1'`);
    // Update deleted_at again (already deleted  -  trigger ELSIF doesn't match)
    await db.query(`UPDATE pages SET deleted_at = NOW() WHERE id = 'p1'`);
    expect(await getPageCount()).toBe(0);
  });

  it('increments page_count when a soft-deleted page is restored', async () => {
    await db.query(`INSERT INTO pages (id, site_id) VALUES ('p1', 's1')`);
    await db.query(`UPDATE pages SET deleted_at = NOW() WHERE id = 'p1'`);
    expect(await getPageCount()).toBe(0);

    await db.query(`UPDATE pages SET deleted_at = NULL WHERE id = 'p1'`);
    expect(await getPageCount()).toBe(1);
  });

  it('tracks multiple pages for a site independently', async () => {
    await db.query(
      `INSERT INTO pages (id, site_id) VALUES ('p1', 's1'), ('p2', 's1'), ('p3', 's1')`,
    );
    expect(await getPageCount()).toBe(3);

    await db.query(`UPDATE pages SET deleted_at = NOW() WHERE id = 'p2'`);
    expect(await getPageCount()).toBe(2);
  });
});
