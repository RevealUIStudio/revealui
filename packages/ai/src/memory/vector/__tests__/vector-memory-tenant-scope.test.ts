/**
 * Tenant isolation for vector memory search.
 * Two sites are seeded. A scoped search returns only that site.
 * A missing scope throws and does not return rows.
 */

import { agentMemories, sites } from '@revealui/db/schema';
import { createTestDb, seedTestUser, type TestDb } from '@revealui/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  siteIdsFromSearchOptions,
  UnscopedMemorySearchError,
  VectorMemoryService,
} from '../vector-memory-service.js';

type RestClient = ConstructorParameters<typeof VectorMemoryService>[0];

const VECTOR = new Array<number>(768).fill(0);
VECTOR[0] = 1;

describe('siteIdsFromSearchOptions', () => {
  it('rejects a missing site', () => {
    expect(() => siteIdsFromSearchOptions({ limit: 5 })).toThrow(UnscopedMemorySearchError);
  });

  it('rejects a blank site', () => {
    expect(() => siteIdsFromSearchOptions({ siteId: '   ', siteIds: ['', '  '] })).toThrow(
      UnscopedMemorySearchError,
    );
  });

  it('keeps a non-empty site and drops blanks', () => {
    expect(
      siteIdsFromSearchOptions({ siteId: ' tenant-a ', siteIds: ['tenant-a', 'tenant-b'] }),
    ).toEqual(['tenant-a', 'tenant-b']);
  });
});

describe('VectorMemoryService tenant scope', () => {
  let testDb: TestDb;
  let service: VectorMemoryService;

  beforeAll(async () => {
    testDb = await createTestDb({ enableVector: true });
    await seedTestUser(testDb.drizzle, {
      id: 'user-a',
      name: 'Tenant A',
      email: 'tenant-a@example.com',
    });
    await seedTestUser(testDb.drizzle, {
      id: 'user-b',
      name: 'Tenant B',
      email: 'tenant-b@example.com',
    });
    await testDb.drizzle.insert(sites).values([
      { id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a', ownerId: 'user-a' },
      { id: 'tenant-b', name: 'Tenant B', slug: 'tenant-b', ownerId: 'user-b' },
    ]);
    await testDb.drizzle.insert(agentMemories).values([
      {
        id: 'mem-tenant-a',
        content: 'tenant-a secret',
        type: 'fact',
        source: { type: 'user', id: 'user-a', confidence: 1 },
        embedding: VECTOR,
        siteId: 'tenant-a',
      },
      {
        id: 'mem-tenant-b',
        content: 'tenant-b secret',
        type: 'fact',
        source: { type: 'user', id: 'user-b', confidence: 1 },
        embedding: VECTOR,
        siteId: 'tenant-b',
      },
    ]);
    service = new VectorMemoryService(testDb.drizzle as unknown as RestClient);
  }, 90_000);

  afterAll(async () => {
    await testDb?.close();
  });

  it('returns tenant-a rows and never tenant-b rows', async () => {
    const results = await service.searchSimilar(VECTOR, {
      siteId: 'tenant-a',
      limit: 5,
      threshold: 0,
    });

    expect(results.map((row) => row.memory.content)).toEqual(['tenant-a secret']);
    expect(results.some((row) => row.memory.content.includes('tenant-b'))).toBe(false);
  });

  it('returns tenant-b rows when that site is the scope', async () => {
    const results = await service.searchSimilar(VECTOR, {
      siteIds: ['tenant-b'],
      limit: 5,
      threshold: 0,
    });

    expect(results.map((row) => row.memory.content)).toEqual(['tenant-b secret']);
  });

  it('throws on a missing scope and does not return global rows', async () => {
    await expect(service.searchSimilar(VECTOR, { limit: 5, threshold: 0 })).rejects.toBeInstanceOf(
      UnscopedMemorySearchError,
    );
    await expect(
      service.searchSimilar(VECTOR, { siteId: ' ', limit: 5, threshold: 0 }),
    ).rejects.toBeInstanceOf(UnscopedMemorySearchError);
  });
});
