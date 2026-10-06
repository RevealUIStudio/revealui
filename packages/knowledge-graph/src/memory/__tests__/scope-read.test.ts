import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKgTestDb, type KgTestDb } from '../../__tests__/test-db.js';
import { deriveNodeId } from '../../ids.js';
import { ingestEpisode } from '../../ingest/index.js';
import { kgNeighbors, kgPath, kgSearch } from '../../search/index.js';
import { publishMemory } from '../publish.js';
import { queryClaims, queryMemory } from '../query.js';
import { countDeniedMemoryHits, inspectNodeVisibility } from '../scope-read.js';
import { tenantNaturalKey } from '../tenant-key.js';
import type { MemoryPrincipal } from '../types.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

function hosted(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revealfleet:user_a:fpa',
    agentId: 'user_a',
    fingerprint: 'fpa',
    didKind: 'user-account-fallback',
    harness: 'cursor',
    tenantId: 'acct_a',
    trustBoundary: 'hosted',
    isFleetOperator: false,
    ...partial,
  };
}

const tenantB = hosted({
  did: 'did:revealfleet:user_b:fpb',
  agentId: 'user_b',
  fingerprint: 'fpb',
  tenantId: 'acct_b',
});

const operator = hosted({
  did: 'did:revealfleet:ops:fpops',
  agentId: 'ops',
  fingerprint: 'fpops',
  isFleetOperator: true,
});

const SCAN_KEY = 'revealui/packages/ai/src/llm/client.ts';

async function seedScan(): Promise<void> {
  await ingestEpisode(db.exec, {
    episode: {
      episodeType: 'code-scan',
      source: 'revkg',
      siteId: 'test',
      content: 'scan of the LLM client factory',
      contentRef: { extractor: 'ts-project' },
      referenceTime: new Date('2026-01-01T00:00:00Z'),
    },
    nodes: [
      {
        kind: 'file',
        name: 'client.ts',
        naturalKey: SCAN_KEY,
        repo: 'revealui',
        summary: 'the LLM client factory',
      },
      { kind: 'symbol', name: 'getClient', naturalKey: `${SCAN_KEY}#getClient` },
    ],
    edges: [
      {
        source: { kind: 'file', naturalKey: SCAN_KEY },
        target: { kind: 'symbol', naturalKey: `${SCAN_KEY}#getClient` },
        relation: 'exports',
        fact: 'client.ts exports getClient',
      },
    ],
  });
}

describe('queryMemory scope', () => {
  it('returns ok empty when nothing exists', async () => {
    const result = await queryMemory(db.exec, { principal: hosted(), query: 'lantern' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.enforcement).toBe('enforced');
    expect(result.deniedCount).toBe(0);
    expect(result.data.nodes).toEqual([]);
    expect(result.data.facts).toEqual([]);
  });

  it('denies when only out-of-scope memory-schema hits exist', async () => {
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'lantern finding about retries',
      subjects: [{ kind: 'concept', name: 'retries', naturalKey: 'concept:retries' }],
      siteId: 'test',
    });
    const result = await queryMemory(db.exec, { principal: tenantB, query: 'lantern' });
    expect(result.status).toBe('denied');
    if (result.status !== 'denied') return;
    expect(result.deniedCount).toBeGreaterThan(0);
    expect(result.reason).toBe('scope-denied');
  });

  it('returns in-scope facts for the same tenant', async () => {
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'lantern finding about retries',
      subjects: [{ kind: 'concept', name: 'retries', naturalKey: 'concept:retries' }],
      siteId: 'test',
    });
    const result = await queryMemory(db.exec, { principal: hosted(), query: 'lantern' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.facts.length + result.data.nodes.length).toBeGreaterThan(0);
    expect(result.deniedCount).toBe(0);
  });

  it('hides private facts from a different DID in the same tenant', async () => {
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'private' },
      summary: 'private lantern secret',
      subjects: [{ kind: 'concept', name: 'secret', naturalKey: 'concept:secret' }],
      siteId: 'test',
    });
    const peer = hosted({
      did: 'did:revealfleet:user_peer:fpp',
      agentId: 'user_peer',
      fingerprint: 'fpp',
    });
    const result = await queryMemory(db.exec, { principal: peer, query: 'lantern' });
    expect(result.status).toBe('denied');
  });

  it('does not post-filter LIMIT: in-scope page is full when enough in-scope rows exist', async () => {
    for (let i = 0; i < 25; i++) {
      await publishMemory(db.exec, {
        principal: hosted(),
        scope: { tenantId: 'acct_a', classification: 'workspace' },
        summary: `lantern in-scope ${i}`,
        subjects: [{ kind: 'concept', name: `in-${i}`, naturalKey: `concept:in-${i}` }],
        siteId: 'test',
      });
      await publishMemory(db.exec, {
        principal: tenantB,
        scope: { tenantId: 'acct_b', classification: 'workspace' },
        summary: `lantern out-scope ${i}`,
        subjects: [{ kind: 'concept', name: `out-${i}`, naturalKey: `concept:out-${i}` }],
        siteId: 'test',
      });
    }
    const result = await queryMemory(db.exec, {
      principal: hosted(),
      query: 'lantern',
      limit: 20,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.facts.length).toBe(20);
    expect(result.data.nodes.every((n) => !n.naturalKey.startsWith('tenant:acct_b:'))).toBe(true);
    expect(result.deniedCount).toBeGreaterThanOrEqual(20);
    const denied = await countDeniedMemoryHits(db.exec, 'lantern', hosted());
    expect(denied).toBe(result.deniedCount);
    expect(result.data.facts.every((f) => !f.fact.includes('out-scope'))).toBe(true);
    expect(result.data.facts.some((f) => f.fact.includes('in-scope'))).toBe(true);
  });

  it('does not return fleet scan nodes to a hosted non-operator', async () => {
    await seedScan();
    const result = await queryMemory(db.exec, { principal: hosted(), query: 'client' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.nodes.some((n) => n.naturalKey === SCAN_KEY)).toBe(false);
  });

  it('hides unattributed nodes even from a local fleet operator', async () => {
    await ingestEpisode(db.exec, {
      episode: { episodeType: 'manual', source: 'test', siteId: 'test', referenceTime: new Date() },
      nodes: [{ kind: 'concept', name: 'unattributed', naturalKey: 'concept:unattributed' }],
      edges: [],
    });
    const result = await kgSearch(db.exec, {
      query: 'unattributed',
      principal: { ...operator, trustBoundary: 'studio-local' },
    });
    expect(result.nodes).toEqual([]);
    expect((await kgSearch(db.exec, { query: 'unattributed' })).nodes).toHaveLength(1);
  });

  it('lets a fleet operator see code-scan provenance', async () => {
    await seedScan();
    const result = await kgSearch(db.exec, { query: 'client', principal: operator });
    expect(result.nodes.some((n) => n.naturalKey === SCAN_KEY)).toBe(true);
  });
});

describe('graph-walk scope', () => {
  it('does not walk another tenant discovered edge', async () => {
    const published = await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'alpha hop',
      subjects: [
        { kind: 'concept', name: 'alpha', naturalKey: 'concept:alpha' },
        { kind: 'concept', name: 'beta', naturalKey: 'concept:beta' },
      ],
      extraEdges: [
        {
          source: { kind: 'concept', naturalKey: 'concept:alpha' },
          target: { kind: 'concept', naturalKey: 'concept:beta' },
          relation: 'relates-to',
          fact: 'alpha relates to beta',
        },
      ],
      siteId: 'test',
    });
    expect(published.status).toBe('ok');

    const aKey = tenantNaturalKey('acct_a', 'concept:alpha');
    const bKey = tenantNaturalKey('acct_a', 'concept:beta');
    const ids = await db.exec.query<{ id: string; natural_key: string }>(
      `SELECT id, natural_key FROM kg_nodes WHERE natural_key = $1 OR natural_key = $2`,
      [aKey, bKey],
    );
    const alphaId = ids.find((r) => r.natural_key === aKey)?.id;
    const betaId = ids.find((r) => r.natural_key === bKey)?.id;
    expect(alphaId).toBeDefined();
    expect(betaId).toBeDefined();
    if (!(alphaId && betaId)) return;

    const neighborsB = await kgNeighbors(db.exec, alphaId, { depth: 2, principal: tenantB });
    expect(neighborsB.nodes.some((n) => n.naturalKey === bKey)).toBe(false);
    expect(neighborsB.edges).toEqual([]);

    const pathB = await kgPath(db.exec, alphaId, betaId, { principal: tenantB });
    expect(pathB).toBeNull();

    const pathA = await kgPath(db.exec, alphaId, betaId, { principal: hosted() });
    expect(pathA).not.toBeNull();
  });

  it('counts kg_context budget after the visibility filter', async () => {
    await seedScan();
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'memory only lantern',
      subjects: [{ kind: 'file', name: 'client.ts', naturalKey: SCAN_KEY }],
      siteId: 'test',
    });
    const prefixed = tenantNaturalKey('acct_a', SCAN_KEY);
    const rows = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_nodes WHERE natural_key = $1`,
      [prefixed],
    );
    expect(rows[0]?.id).toBeDefined();
    if (!rows[0]) return;
    const neighbors = await kgNeighbors(db.exec, rows[0].id, { depth: 2, principal: hosted() });
    expect(neighbors.nodes.some((n) => n.naturalKey === SCAN_KEY)).toBe(false);
    expect(neighbors.edges.length).toBeGreaterThan(0);
  });
});

describe('inspectNodeVisibility', () => {
  it('returns missing for a code-scan-only node to a hosted non-operator', async () => {
    await seedScan();
    const rows = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_nodes WHERE natural_key = $1`,
      [SCAN_KEY],
    );
    expect(await inspectNodeVisibility(db.exec, rows[0]?.id ?? '', hosted())).toBe('missing');
  });

  it('returns shell for mixed provenance on a hosted non-operator', async () => {
    const mixedKey = tenantNaturalKey('acct_a', 'app/mixed.ts');
    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'code-scan',
        source: 'revkg',
        siteId: 'test',
        content: 'scan shell',
        contentRef: { extractor: 'ts-project' },
        referenceTime: new Date('2026-01-01T00:00:00Z'),
      },
      nodes: [
        {
          kind: 'file',
          name: 'mixed.ts',
          naturalKey: mixedKey,
          summary: 'fleet scan summary',
          attributes: { scan: true },
        },
        { kind: 'symbol', name: 'run', naturalKey: `${mixedKey}#run` },
      ],
      edges: [
        {
          source: { kind: 'file', naturalKey: mixedKey },
          target: { kind: 'symbol', naturalKey: `${mixedKey}#run` },
          relation: 'exports',
          fact: 'mixed.ts exports run',
        },
      ],
    });
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'customer lantern on mixed',
      subjects: [{ kind: 'file', name: 'mixed.ts', naturalKey: 'app/mixed.ts' }],
      siteId: 'test',
    });
    const rows = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_nodes WHERE natural_key = $1`,
      [mixedKey],
    );
    expect(await inspectNodeVisibility(db.exec, rows[0]?.id ?? '', hosted())).toBe('shell');
  });
});

describe('queryClaims hosted', () => {
  it('returns only in-scope open claims', async () => {
    await publishMemory(db.exec, {
      principal: hosted(),
      scope: { tenantId: 'acct_a', classification: 'workspace' },
      summary: 'open claim lantern',
      subjects: [{ kind: 'file', name: 'a.ts', naturalKey: 'a.ts' }],
      claim: { kind: 'file', status: 'open', paths: ['a.ts'] },
      siteId: 'test',
    });
    await publishMemory(db.exec, {
      principal: tenantB,
      scope: { tenantId: 'acct_b', classification: 'workspace' },
      summary: 'other tenant claim',
      subjects: [{ kind: 'file', name: 'b.ts', naturalKey: 'b.ts' }],
      claim: { kind: 'file', status: 'open', paths: ['b.ts'] },
      siteId: 'test',
    });
    const mine = await queryClaims(db.exec, { principal: hosted() });
    expect(mine.status).toBe('ok');
    if (mine.status !== 'ok') return;
    expect(mine.enforcement).toBe('enforced');
    expect(mine.data.claims).toHaveLength(1);
    expect(mine.data.claims[0]?.targetNaturalKey).toBe(tenantNaturalKey('acct_a', 'a.ts'));
  });
});

describe('local publication metadata scope', () => {
  it('keeps private metadata separate from a shared subject with the same key', async () => {
    const author = { ...operator, trustBoundary: 'studio-local' as const };
    const publish = (classification: 'private' | 'workspace', name: string) =>
      publishMemory(db.exec, {
        principal: author,
        scope: { tenantId: author.tenantId, classification },
        summary: name,
        subjects: [{ kind: 'concept', naturalKey: 'concept:reused', name, summary: name }],
        siteId: 'test',
      });
    expect((await publish('workspace', 'brassshared')).status).toBe('ok');
    expect((await publish('private', 'saffronprivate')).status).toBe('ok');
    const peer = {
      ...author,
      ...tenantB,
      tenantId: author.tenantId,
      trustBoundary: 'studio-local' as const,
      isFleetOperator: true,
    };
    const result = await queryMemory(db.exec, { principal: peer, query: 'brassshared' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.nodes).toContainEqual(
      expect.objectContaining({ name: 'brassshared', summary: 'brassshared' }),
    );
    expect(JSON.stringify(result)).not.toContain('saffronprivate');
    expect((await queryMemory(db.exec, { principal: peer, query: 'saffronprivate' })).status).toBe(
      'denied',
    );
  });

  it('queries private claims by the original subject key', async () => {
    const principal = { ...operator, trustBoundary: 'studio-local' as const };
    expect(
      (
        await publishMemory(db.exec, {
          principal,
          scope: { tenantId: principal.tenantId, classification: 'private' },
          summary: 'private intent',
          subjects: [{ kind: 'concept', name: 'intent', naturalKey: 'concept:intent' }],
          claim: { kind: 'intent', status: 'open' },
          siteId: 'test',
        })
      ).status,
    ).toBe('ok');
    const result = await queryClaims(db.exec, { principal, subjectNaturalKey: 'concept:intent' });
    expect(result).toMatchObject({
      status: 'ok',
      data: { claims: [expect.objectContaining({ claimKind: 'intent' })] },
    });
  });
});

describe('legacy memory provenance quarantine', () => {
  it('hides metadata contaminated by historical private writes, including scan paths', async () => {
    await seedScan();
    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'agent-fact',
        source: 'legacy',
        siteId: 'test',
        referenceTime: new Date(),
        contentRef: {
          schema: 'revealui.memory.v1',
          actorDid: operator.did,
          scope: { tenantId: operator.tenantId, classification: 'private' },
        },
      },
      nodes: [
        { kind: 'agent', name: operator.agentId, naturalKey: operator.did },
        { kind: 'file', name: 'saffronprivate', summary: 'saffronprivate', naturalKey: SCAN_KEY },
      ],
      edges: [
        {
          source: { kind: 'agent', naturalKey: operator.did },
          target: { kind: 'file', naturalKey: SCAN_KEY },
          relation: 'discovered',
          fact: 'saffronprivate',
        },
      ],
    });
    const principal = { ...operator, trustBoundary: 'studio-local' as const };
    expect((await kgSearch(db.exec, { query: 'client', principal })).nodes).toEqual([]);
    expect((await kgSearch(db.exec, { query: 'saffronprivate', principal })).nodes).toEqual([]);
    expect(await inspectNodeVisibility(db.exec, deriveNodeId('file', SCAN_KEY), principal)).toBe(
      'missing',
    );
    expect((await kgSearch(db.exec, { query: 'saffronprivate' })).nodes.length).toBeGreaterThan(0);
  });
});
