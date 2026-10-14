import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../testing/drizzle-test-db.js';

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb?.close();
});

it('preserves quoted semicolons, nested comments and named dollar-quoted function bodies', async () => {
  const migrationsDir = await mkdtemp(join(tmpdir(), 'revealui-migration-fixture-'));
  let fixture: TestDb | undefined;
  try {
    await writeFile(
      join(migrationsDir, '0000_fixture.sql'),
      String.raw`
      CREATE TABLE migration_fixture (value text);
      /* outer ; /* nested ; */ still outer ; */
      INSERT INTO migration_fixture VALUES ('literal;quote''tail'), ('backslash\');
      INSERT INTO migration_fixture VALUES (E'escaped\';tail');
      DO $migration_body$ BEGIN
        INSERT INTO migration_fixture VALUES ('function;body');
      END $migration_body$;
      -- ignored ; delimiter
      INSERT INTO migration_fixture VALUES ('last');
    `,
    );
    fixture = await createTestDb({ migrationsDir });
    expect((await fixture.pglite.query('SELECT value FROM migration_fixture')).rows).toEqual([
      { value: "literal;quote'tail" },
      { value: 'backslash\\' },
      { value: "escaped';tail" },
      { value: 'function;body' },
      { value: 'last' },
    ]);
  } finally {
    await fixture?.close();
    await rm(migrationsDir, { recursive: true, force: true });
  }
});

it('applies search and PL/pgSQL statements from mixed vector migrations without pgvector', async () => {
  await testDb.pglite.exec(`
    INSERT INTO users (id, name, email) VALUES ('search-owner', 'Owner', 'search@example.test');
    INSERT INTO sites (id, name, slug, owner_id) VALUES ('search-site', 'Search', 'search', 'search-owner');
    INSERT INTO pages (id, site_id, title, slug, path)
      VALUES ('search-page', 'search-site', 'Confidential needle', 'home', '/');
  `);
  expect(
    (
      await testDb.pglite.query(
        "SELECT id FROM pages WHERE search_vector @@ plainto_tsquery('english', 'needle')",
      )
    ).rows,
  ).toEqual([{ id: 'search-page' }]);
  expect(
    (await testDb.pglite.query("SELECT page_count FROM sites WHERE id='search-site'")).rows,
  ).toEqual([{ page_count: 1 }]);
  await testDb.pglite.exec("UPDATE pages SET title='Updated index' WHERE id='search-page'");
  expect(
    (
      await testDb.pglite.query(
        "SELECT id FROM pages WHERE search_vector @@ plainto_tsquery('english', 'updated')",
      )
    ).rows,
  ).toEqual([{ id: 'search-page' }]);
});
