import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKgTestDb, type KgTestDb } from '../../__tests__/test-db.js';
import { deriveNodeId } from '../../ids.js';
import { ingestEpisode } from '../../ingest/index.js';
import { publishMemory } from '../publish.js';
import { queryClaims, queryMemory } from '../query.js';
import { tenantNaturalKey } from '../tenant-key.js';
import type { MemoryPrincipal } from '../types.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

function studioPrincipal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:grok-1:fpabc',
    agentId: 'grok-1',
    fingerprint: 'fpabc',
    didKind: 'agent-key',
    harness: 'grok',
    tenantId: 'studio-local',
    trustBoundary: 'studio-local',
    isFleetOperator: true,
    ...partial,
  };
}

function hostedPrincipal(partial: Partial<MemoryPrincipal> = {}): MemoryPrincipal {
  return {
    did: 'did:revfleet:user_abc:fpxyz',
    agentId: 'user_abc',
    fingerprint: 'fpxyz',
    didKind: 'user-account-fallback',
    harness: 'cursor',
    tenantId: 'acct_1',
    trustBoundary: 'hosted',
    isFleetOperator: false,
    ...partial,
  };
}

const SCAN_KEY = 'revealui/packages/mcp/src/servers/factories/knowledge-graph.ts';

describe('publishMemory', () => {
  it('returns unavailable for a missing principal and never throws', async () => {
    const result = await publishMemory(db.exec, {
      principal: {
        did: '',
        agentId: '',
        fingerprint: '',
        didKind: 'agent-key',
        harness: 'grok',
        tenantId: '',
        trustBoundary: 'studio-local',
        isFleetOperator: true,
      },
      scope: { tenantId: 'studio-local', classification: 'workspace' },
      summary: 'finding',
      subjects: [{ kind: 'file', name: 'foo.ts', naturalKey: 'foo.ts' }],
      siteId: 'test',
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toBe('principal-missing');
  });

  it('rejects studio-local tenant on the hosted boundary', async () => {
    const result = await publishMemory(db.exec, {
      principal: hostedPrincipal({ tenantId: 'studio-local' }),
      scope: { tenantId: 'studio-local', classification: 'workspace' },
      summary: 'nope',
      subjects: [{ kind: 'file', name: 'foo.ts', naturalKey: 'foo.ts' }],
      siteId: 'test',
    });
    expect(result.status).toBe('unavailable');
  });

  it('does not ON CONFLICT a pre-seeded scan node when namespacing hosted writes', async () => {
    const scanId = deriveNodeId('file', SCAN_KEY);
    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'code-scan',
        source: 'revkg',
        siteId: 'test',
        content: 'scan',
        contentRef: { extractor: 'ts-project' },
        referenceTime: new Date('2026-01-01T00:00:00Z'),
      },
      nodes: [
        {
          kind: 'file',
          name: 'knowledge-graph.ts',
          naturalKey: SCAN_KEY,
          repo: 'revealui',
          summary: 'fleet scan shell',
        },
      ],
      edges: [],
    });

    const published = await publishMemory(db.exec, {
      principal: hostedPrincipal(),
      scope: { tenantId: 'acct_1', classification: 'workspace' },
      summary: 'customer finding',
      subjects: [{ kind: 'file', name: 'knowledge-graph.ts', naturalKey: SCAN_KEY }],
      siteId: 'test',
    });
    expect(published.status).toBe('ok');

    const prefixed = tenantNaturalKey('acct_1', SCAN_KEY);
    const memoryId = deriveNodeId('file', prefixed);
    expect(memoryId).not.toBe(scanId);

    const scanRow = await db.exec.query<{ summary: string | null; natural_key: string }>(
      `SELECT summary, natural_key FROM kg_nodes WHERE id = $1`,
      [scanId],
    );
    expect(scanRow[0]?.summary).toBe('fleet scan shell');
    expect(scanRow[0]?.natural_key).toBe(SCAN_KEY);

    const memoryRow = await db.exec.query<{ natural_key: string }>(
      `SELECT natural_key FROM kg_nodes WHERE id = $1`,
      [memoryId],
    );
    expect(memoryRow[0]?.natural_key).toBe(prefixed);
  });

  it('returns the stored prefixed key for a later claims query on the same client path', async () => {
    const clientKey = 'app/src/foo.ts';
    const published = await publishMemory(db.exec, {
      principal: hostedPrincipal(),
      scope: { tenantId: 'acct_1', classification: 'workspace' },
      summary: 'working here',
      subjects: [{ kind: 'file', name: 'foo.ts', naturalKey: clientKey }],
      claim: { kind: 'file', status: 'open', paths: [clientKey] },
      siteId: 'test',
    });
    expect(published.status).toBe('ok');

    // Hosted reads stay unwired in this slice; inspect stored keys directly.
    const prefixed = tenantNaturalKey('acct_1', clientKey);
    const rows = await db.exec.query<{ natural_key: string }>(
      `SELECT natural_key FROM kg_nodes WHERE kind = 'file' AND natural_key = $1`,
      [prefixed],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.natural_key).toBe(prefixed);
  });
});

describe('queryMemory', () => {
  it('returns unavailable for a missing principal and never throws', async () => {
    const result = await queryMemory(db.exec, {
      principal: studioPrincipal({ did: '', agentId: '', fingerprint: '' }),
      query: 'anything',
    });
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toBe('principal-missing');
  });
});

describe('queryClaims', () => {
  it('hides resolved claims', async () => {
    const principal = studioPrincipal();
    const key = 'app/src/bar.ts';
    await publishMemory(db.exec, {
      principal,
      scope: { tenantId: 'studio-local', classification: 'workspace' },
      summary: 'open claim',
      subjects: [{ kind: 'file', name: 'bar.ts', naturalKey: key }],
      claim: { kind: 'file', status: 'open', paths: [key] },
      siteId: 'test',
    });
    await publishMemory(db.exec, {
      principal,
      scope: { tenantId: 'studio-local', classification: 'workspace' },
      summary: 'resolved claim',
      subjects: [{ kind: 'file', name: 'bar.ts', naturalKey: key }],
      claim: { kind: 'file', status: 'resolved', paths: [key] },
      siteId: 'test',
    });

    const result = await queryClaims(db.exec, { principal, subjectNaturalKey: key });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.claims).toHaveLength(1);
    expect(result.data.claims[0]?.status).toBe('open');
    expect(result.data.claims[0]?.claimKind).toBe('file');
  });

  it('serves hosted claims under the scope filter', async () => {
    const result = await queryClaims(db.exec, { principal: hostedPrincipal() });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.enforcement).toBe('enforced');
    expect(result.data.claims).toEqual([]);
  });
});
