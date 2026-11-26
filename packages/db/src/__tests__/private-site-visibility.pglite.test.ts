import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});
afterAll(async () => {
  await db.close();
});
it('migrates existing sites to explicit public visibility and rejects invalid audiences on reapplication', async () => {
  await db.exec("CREATE TABLE sites (id text PRIMARY KEY); INSERT INTO sites VALUES ('legacy');");
  const migration = await readFile(
    new URL('../../migrations/0050_private_site_visibility.sql', import.meta.url),
    'utf8',
  );
  await db.exec(migration);
  await db.exec(migration);
  expect((await db.query('SELECT visibility FROM sites')).rows).toEqual([{ visibility: 'public' }]);
  await db.exec("UPDATE sites SET visibility='private' WHERE id='legacy'");
  await expect(db.exec("UPDATE sites SET visibility='unlisted'")).rejects.toThrow(
    'sites_visibility_check',
  );
  await db.exec(migration);
  expect((await db.query('SELECT visibility FROM sites')).rows).toEqual([
    { visibility: 'private' },
  ]);
});
