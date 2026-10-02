import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { describe, expect, it } from 'vitest';
import { getPagesBySite, updatePage } from '../queries/pages.js';

describe('page creator attribution', () => {
  it('keeps legacy pages unclaimed and scopes real queries by creator, site and soft deletion', async () => {
    const client = new PGlite();
    try {
      await client.waitReady;
      await client.exec(`CREATE TABLE users (id text PRIMARY KEY);
        INSERT INTO users VALUES ('actor'), ('other');
        CREATE TABLE pages (
          id text PRIMARY KEY, schema_version text DEFAULT '1', version integer DEFAULT 1,
          site_id text NOT NULL, parent_id text, template_id text, title text, slug text,
          path text, status text DEFAULT 'draft', blocks jsonb, seo jsonb,
          block_count integer, word_count integer, lock jsonb, scheduled_at timestamptz,
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
          published_at timestamptz, deleted_at timestamptz
        );
        INSERT INTO pages (id, site_id, title, slug, path) VALUES ('legacy', 'one', 'Old', 'old', '/old');`);
      const migration = await readFile(
        new URL('../../migrations/0049_page_creator_attribution.sql', import.meta.url),
        'utf8',
      );
      await client.exec(migration);
      await client.exec(migration);
      expect((await client.query("SELECT created_by FROM pages WHERE id='legacy'")).rows).toEqual([
        { created_by: null },
      ]);
      await client.exec(`INSERT INTO pages (id,site_id,title,slug,path,created_by,deleted_at) VALUES
        ('own','one','Own','own','/own','actor',NULL),
        ('other','one','Other','other','/other','other',NULL),
        ('elsewhere','two','Elsewhere','elsewhere','/elsewhere','actor',NULL),
        ('deleted','one','Deleted','deleted','/deleted','actor',now());`);
      const db = drizzle(client);
      expect(
        (await getPagesBySite(db as never, 'one', { createdBy: 'actor' })).map((p) => p.id),
      ).toEqual(['own']);
      await updatePage(db as never, 'own', { createdBy: 'other', title: 'Updated' });
      expect(
        (await getPagesBySite(db as never, 'one', { createdBy: 'actor' })).map((p) => p.id),
      ).toEqual(['own']);
      await updatePage(db as never, 'legacy', { createdBy: 'actor', title: 'Edited' });
      expect(
        (await getPagesBySite(db as never, 'one', { createdBy: 'actor' })).map((p) => p.id),
      ).toEqual(['own']);
      await client.exec("DELETE FROM users WHERE id='actor'");
      expect(await getPagesBySite(db as never, 'one', { createdBy: 'actor' })).toEqual([]);
      expect((await client.query("SELECT created_by FROM pages WHERE id='own'")).rows).toEqual([
        { created_by: null },
      ]);
    } finally {
      await client.close();
    }
  });
});
