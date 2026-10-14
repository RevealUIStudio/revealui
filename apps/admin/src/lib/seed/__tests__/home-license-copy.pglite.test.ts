import { pages, sites, users } from '@revealui/db/schema';
import { createTestDb, type TestDb } from '@revealui/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  persistRefreshedLicenseBlocks,
  STALE_ABOUT_LICENSE_SENTENCE,
  STALE_HOME_LICENSE_SENTENCE,
} from '../home-license-copy';

const CURRENT =
  '26 of the 33 packages are MIT, forever. The 5 Pro packages are Fair Source (FSL-1.1-MIT) and convert to MIT two years after each release. The remaining 2 workspace packages are internal tooling with no public license.';

const ABOUT =
  'The core runtime is MIT-licensed. The 5 Pro packages (ai, engines, harnesses, mcp, and services) are Fair Source (FSL-1.1-MIT): source-visible, commercially usable except as a competing developer platform, and each release converts to MIT two years after it ships.';

function textBlock(text: string): unknown[] {
  return [
    {
      blockType: 'content',
      columns: [{ richText: { root: { children: [{ type: 'text', text }] } } }],
    },
  ];
}

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.drizzle.insert(users).values({
    id: 'owner',
    name: 'owner',
    email: 'owner@example.test',
    status: 'active',
    role: 'owner',
  });
  await testDb.drizzle.insert(sites).values({
    id: 'site',
    ownerId: 'owner',
    name: 'Site',
    slug: 'site',
    status: 'published',
  });
  await testDb.drizzle.insert(pages).values([
    {
      id: 'home',
      siteId: 'site',
      title: 'Home',
      slug: 'home',
      path: '/',
      status: 'published',
      blocks: textBlock(
        `Auth, billing, content, and agents - wired. ${STALE_HOME_LICENSE_SENTENCE}`,
      ),
      blockCount: 1,
      version: 1,
    },
    {
      id: 'about',
      siteId: 'site',
      title: 'About',
      slug: 'about',
      path: '/about',
      status: 'published',
      blocks: textBlock(STALE_ABOUT_LICENSE_SENTENCE),
      blockCount: 1,
      version: 1,
    },
    {
      id: 'custom',
      siteId: 'site',
      title: 'Custom',
      slug: 'custom',
      path: '/custom',
      status: 'published',
      blocks: textBlock('A page the operator rewrote.'),
      blockCount: 1,
      version: 1,
    },
    {
      id: 'gone',
      siteId: 'site',
      title: 'Gone',
      slug: 'gone',
      path: '/gone',
      status: 'published',
      blocks: textBlock(STALE_HOME_LICENSE_SENTENCE),
      blockCount: 1,
      deletedAt: new Date(),
    },
  ]);
});

afterAll(async () => {
  await testDb.close();
});

describe('persistRefreshedLicenseBlocks', () => {
  it('writes corrected home and about blocks and leaves other rows stored', async () => {
    const db = testDb.drizzle as never;
    expect(
      await persistRefreshedLicenseBlocks(
        db,
        'home',
        textBlock(`Auth, billing, content, and agents - wired. ${STALE_HOME_LICENSE_SENTENCE}`),
        CURRENT,
        ABOUT,
      ),
    ).toBe('updated');
    expect(
      await persistRefreshedLicenseBlocks(
        db,
        'about',
        textBlock(STALE_ABOUT_LICENSE_SENTENCE),
        CURRENT,
        ABOUT,
      ),
    ).toBe('updated');
    expect(
      await persistRefreshedLicenseBlocks(
        db,
        'custom',
        textBlock('A page the operator rewrote.'),
        CURRENT,
        ABOUT,
      ),
    ).toBe('unchanged');
    expect(
      await persistRefreshedLicenseBlocks(
        db,
        'gone',
        textBlock(STALE_HOME_LICENSE_SENTENCE),
        CURRENT,
        ABOUT,
      ),
    ).toBe('missing');

    const stored = await testDb.drizzle.select().from(pages).where(eq(pages.siteId, 'site'));
    const byId = new Map(stored.map((row) => [row.id, row]));

    const home = JSON.stringify(byId.get('home')?.blocks);
    expect(home).toContain(CURRENT);
    expect(home).toContain('agents: wired');
    expect(home).not.toContain(STALE_HOME_LICENSE_SENTENCE);
    expect(byId.get('home')?.blockCount).toBe(1);
    expect(byId.get('home')?.version).toBe(1);

    const about = JSON.stringify(byId.get('about')?.blocks);
    expect(about).toContain(ABOUT);
    expect(about).not.toContain('commercially licensed for platforms');

    expect(JSON.stringify(byId.get('custom')?.blocks)).toContain('A page the operator rewrote.');
    expect(JSON.stringify(byId.get('gone')?.blocks)).toContain(STALE_HOME_LICENSE_SENTENCE);
  });
});
