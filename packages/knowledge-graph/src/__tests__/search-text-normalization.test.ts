/**
 * GAP-349 FTS name-normalization fix.
 *
 * Live finding: `revkg search "electric proxy"` returned 0 hits against
 * 14k+ real revealui nodes because Postgres's `english` tsvector parser
 * tokenizes hyphenated/path-like names (`electric-proxy.ts`,
 * `apps/admin/src/lib/api/electric-proxy.ts`) as a single opaque token, so
 * word-level `websearch_to_tsquery` queries never matched a `search`
 * tsvector generated from raw name + summary.
 *
 * The `prove-red` describe block below builds the OLD kg_nodes shape
 * (search generated from name + summary only, no search_text) directly —
 * NOT via `kgDdlStatements`, which already carries the fix — and shows the
 * exact failure the ingest-time `search_text` column exists to close. The
 * `fix` describe block ingests through the real engine (current schema +
 * `buildSearchText`) and shows the same queries now match.
 */

import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanEpisode } from '../extractors/shared.js';
import { ingestEpisode } from '../ingest/index.js';
import { kgSearch } from '../search/index.js';
import { segmentWords } from '../search/normalize-text.js';
import type { NodeInput } from '../types.js';
import { createKgTestDb, type KgTestDb } from './test-db.js';

const REPO = 'revealui';
const T = new Date('2026-07-11T00:00:00Z');

describe('search_text normalization — prove-red against the old schema path', () => {
  let pglite: PGlite;

  beforeEach(async () => {
    pglite = new PGlite();
    // The OLD kg_nodes shape (pre-GAP-349): `search` generated from raw
    // name + summary only, no search_text. Minimal standalone table —
    // enough to exercise the exact tsvector-matching behavior that was
    // broken, without depending on the (now-fixed) shared DDL builder.
    await pglite.exec(`CREATE TABLE "kg_nodes" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "natural_key" text NOT NULL,
      "summary" text,
      "search" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'B')
      ) STORED
    )`);
    // Summary deliberately has no relation to "electric"/"proxy" as free
    // words — the point is to isolate the name/naturalKey tokenization
    // failure, not accidentally pass through a matching summary term.
    await pglite.query(
      `INSERT INTO kg_nodes (id, name, natural_key, summary) VALUES ($1, $2, $3, $4)`,
      [
        'old-1',
        'electric-proxy.ts',
        'revealui/apps/admin/src/lib/api/electric-proxy.ts',
        'a route handler file',
      ],
    );
  });

  afterEach(async () => {
    await pglite.close();
  });

  it('does NOT find a hyphenated file name via a word-level query on the old schema', async () => {
    const rows = await pglite.query(
      `SELECT id FROM kg_nodes WHERE search @@ websearch_to_tsquery('english', $1)`,
      ['electric proxy'],
    );
    expect(rows.rows.length).toBe(0);
  });
});

describe('search_text normalization — fix (ingest engine + kgSearch)', () => {
  let db: KgTestDb;

  beforeEach(async () => {
    db = await createKgTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it('finds a hyphenated file name via a word-level FTS query', async () => {
    const nodes: NodeInput[] = [
      {
        kind: 'file',
        name: 'electric-proxy.ts',
        naturalKey: 'revealui/apps/admin/src/lib/api/electric-proxy.ts',
        repo: REPO,
        summary: 'authenticated Electric shape proxy',
      },
    ];
    await ingestEpisode(db.exec, {
      episode: scanEpisode({ repo: REPO, siteId: 's', now: T }, 'ts-project'),
      nodes,
      edges: [],
    });

    const result = await kgSearch(db.exec, { query: 'electric proxy' });
    expect(result.nodes.some((n) => n.naturalKey.endsWith('electric-proxy.ts'))).toBe(true);
  });

  it('finds a camelCase symbol via a word-level FTS query', async () => {
    const nodes: NodeInput[] = [
      {
        kind: 'symbol',
        name: 'getPoolStats',
        naturalKey: 'revealui/packages/db/src/pool.ts#getPoolStats',
        repo: REPO,
      },
    ];
    await ingestEpisode(db.exec, {
      episode: scanEpisode({ repo: REPO, siteId: 's', now: T }, 'ts-project'),
      nodes,
      edges: [],
    });

    const result = await kgSearch(db.exec, { query: 'pool stats' });
    expect(result.nodes.some((n) => n.name === 'getPoolStats')).toBe(true);
  });

  it('still finds an exact single-token query on the original (unnormalized) name', async () => {
    const nodes: NodeInput[] = [
      {
        kind: 'file',
        name: 'electric-proxy.ts',
        naturalKey: 'revealui/apps/admin/src/lib/api/electric-proxy.ts',
        repo: REPO,
      },
    ];
    await ingestEpisode(db.exec, {
      episode: scanEpisode({ repo: REPO, siteId: 's', now: T }, 'ts-project'),
      nodes,
      edges: [],
    });

    const result = await kgSearch(db.exec, { query: 'electric-proxy.ts' });
    expect(result.nodes.some((n) => n.name === 'electric-proxy.ts')).toBe(true);
  });
});

describe('segmentWords', () => {
  it('turns separators into spaces', () => {
    expect(segmentWords('apps/admin/src/lib/api/electric-proxy.ts')).toBe(
      'apps admin src lib api electric proxy ts',
    );
  });

  it('inserts a space at lower/digit → upper camelCase boundaries', () => {
    expect(segmentWords('getPoolStats')).toBe('get Pool Stats');
  });

  it('inserts a space at the acronym → word boundary', () => {
    expect(segmentWords('HTTPServer')).toBe('HTTP Server');
  });

  it('leaves an already-segmented string unchanged', () => {
    expect(segmentWords('already segmented')).toBe('already segmented');
  });
});
