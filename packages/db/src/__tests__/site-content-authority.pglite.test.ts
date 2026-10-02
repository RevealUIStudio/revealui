import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  actorCanManageSite,
  getSiteContentActor,
  getSiteIdsForContentRead,
} from '../queries/sites.js';

let client: PGlite;
beforeAll(async () => {
  client = new PGlite();
  await client.waitReady;
  await client.exec(`CREATE TABLE users (id text PRIMARY KEY, role text, email_verified boolean, _json jsonb, status text, deleted_at timestamptz);
    INSERT INTO users VALUES
      ('owner', 'viewer', true, '{}', 'active', NULL),
      ('tenant', 'admin', true, '{}', 'active', NULL),
      ('unverified', 'admin', false, '{"roles":["super-admin"]}', 'active', NULL),
      ('operator', 'admin', true, '{"roles":["super-admin"]}', 'active', NULL),
      ('disabled', 'admin', true, '{"roles":["super-admin"]}', 'disabled', NULL);
    CREATE TABLE sites (id text PRIMARY KEY, schema_version text, version integer, owner_id text,
      name text, slug text, description text, status text, theme jsonb, settings jsonb,
      page_count integer, favicon text, created_at timestamptz, updated_at timestamptz,
      published_at timestamptz, deleted_at timestamptz);
    INSERT INTO sites (id,owner_id,status,deleted_at) VALUES ('owned','owner','draft',NULL),('foreign','someone-else','published',NULL),('retired','owner','published',now());`);
});
afterAll(async () => {
  await client.close();
});

describe('canonical database site authority', () => {
  it('uses canonical user verification and ownership, preserving only explicit Forge admin authority', async () => {
    const db = drizzle(client);
    const owner = await getSiteContentActor(db as never, 'owner');
    const tenant = await getSiteContentActor(db as never, 'tenant');
    expect(await actorCanManageSite(db as never, owner, 'owned', 'hosted')).toBe(true);
    expect(await getSiteIdsForContentRead(db as never, owner, 'hosted')).toEqual([{ id: 'owned' }]);
    expect(await getSiteIdsForContentRead(db as never, tenant, 'hosted')).toEqual([]);
    expect(await getSiteIdsForContentRead(db as never, null, 'hosted')).toEqual([
      { id: 'foreign' },
    ]);
    expect(
      (
        await getSiteIdsForContentRead(
          db as never,
          await getSiteContentActor(db as never, 'operator'),
          'hosted',
        )
      )
        .map((row) => row.id)
        .sort(),
    ).toEqual(['foreign', 'owned']);
    expect(await actorCanManageSite(db as never, owner, 'foreign', 'hosted')).toBe(false);
    expect(await actorCanManageSite(db as never, tenant, 'foreign', 'hosted')).toBe(false);
    expect(await actorCanManageSite(db as never, tenant, 'foreign', 'forge')).toBe(true);
    expect(
      await actorCanManageSite(
        db as never,
        await getSiteContentActor(db as never, 'unverified'),
        'foreign',
        'hosted',
      ),
    ).toBe(false);
    expect(
      await actorCanManageSite(
        db as never,
        await getSiteContentActor(db as never, 'operator'),
        'foreign',
        'hosted',
      ),
    ).toBe(true);
    expect(await getSiteContentActor(db as never, 'disabled')).toBeNull();
    expect(await getSiteContentActor(db as never, 'missing')).toBeNull();
    expect(await actorCanManageSite(db as never, null, 'owned', 'hosted')).toBe(false);
    await client.exec("UPDATE sites SET deleted_at=now() WHERE id='owned'");
    expect(await actorCanManageSite(db as never, owner, 'owned', 'hosted')).toBe(false);
  });
});
