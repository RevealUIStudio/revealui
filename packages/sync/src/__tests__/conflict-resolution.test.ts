import { describe, expect, it, vi } from 'vitest';
import {
  type ConflictInfo,
  coalesceMutations,
  type OfflineMutation,
  replayMutations,
  resolveConflict,
} from '../conflict-resolution.js';

function makeMutation(overrides: Partial<OfflineMutation> = {}): OfflineMutation {
  return {
    id: crypto.randomUUID(),
    url: 'https://api.example.com/api/posts/1',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Updated' }),
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

describe('coalesceMutations', () => {
  it('keeps all mutations without resourceId', () => {
    const mutations = [makeMutation({ id: 'a' }), makeMutation({ id: 'b' })];
    const result = coalesceMutations(mutations);
    expect(result).toHaveLength(2);
  });

  it('keeps only the latest mutation per resourceId', () => {
    const mutations = [
      makeMutation({ id: 'a', resourceId: 'posts:1', timestamp: 100 }),
      makeMutation({ id: 'b', resourceId: 'posts:1', timestamp: 200 }),
      makeMutation({ id: 'c', resourceId: 'posts:1', timestamp: 150 }),
    ];
    const result = coalesceMutations(mutations);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('keeps latest per resource across different resources', () => {
    const mutations = [
      makeMutation({ id: 'a', resourceId: 'posts:1', timestamp: 100 }),
      makeMutation({ id: 'b', resourceId: 'posts:2', timestamp: 200 }),
      makeMutation({ id: 'c', resourceId: 'posts:1', timestamp: 300 }),
    ];
    const result = coalesceMutations(mutations);
    expect(result).toHaveLength(2);
    const ids = result.map((m) => m.id);
    expect(ids).toContain('b');
    expect(ids).toContain('c');
  });

  it('preserves ungrouped mutations alongside coalesced ones', () => {
    const mutations = [
      makeMutation({ id: 'ungrouped' }),
      makeMutation({ id: 'a', resourceId: 'posts:1', timestamp: 100 }),
      makeMutation({ id: 'b', resourceId: 'posts:1', timestamp: 200 }),
    ];
    const result = coalesceMutations(mutations);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ungrouped');
    expect(result[1].id).toBe('b');
  });

  it('returns empty array for empty input', () => {
    expect(coalesceMutations([])).toEqual([]);
  });
});

describe('resolveConflict', () => {
  const baseConflict: ConflictInfo = {
    mutation: makeMutation(),
    statusCode: 409,
    serverVersion: 5,
    serverData: { title: 'Server Version' },
  };

  it('last-write-wins returns a retry mutation with force headers', async () => {
    const result = await resolveConflict(baseConflict, 'last-write-wins');
    expect(result.resolved).toBe(true);
    expect(result.retryMutation).toBeDefined();
    expect(result.retryMutation?.headers['X-Force-Overwrite']).toBe('true');
    expect(result.retryMutation?.headers['X-Base-Version']).toBe('5');
    expect(result.retryMutation?.retryCount).toBe(1);
  });

  it('server-wins resolves without retry mutation', async () => {
    const result = await resolveConflict(baseConflict, 'server-wins');
    expect(result.resolved).toBe(true);
    expect(result.retryMutation).toBeUndefined();
  });

  it('manual returns unresolved', async () => {
    const result = await resolveConflict(baseConflict, 'manual');
    expect(result.resolved).toBe(false);
    expect(result.retryMutation).toBeUndefined();
  });
});

describe('replayMutations', () => {
  it('replays successful mutations', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const mutations = [makeMutation({ id: 'a' }), makeMutation({ id: 'b' })];
    const result = await replayMutations(mutations);

    expect(result.succeeded).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  it('handles 409 conflict with last-write-wins', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      callCount++;
      // First call: 409, second call (retry with force): 200
      if (callCount === 1 && !init?.headers?.['X-Force-Overwrite' as keyof HeadersInit]) {
        return new Response(JSON.stringify({ version: 5, data: {} }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    });

    const mutations = [makeMutation({ id: 'a', baseVersion: 3 })];
    const result = await replayMutations(mutations, 'last-write-wins');

    expect(result.succeeded).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failed).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it('handles 409 conflict with server-wins (discards mutation)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: 5 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const mutations = [makeMutation({ id: 'a' })];
    const result = await replayMutations(mutations, 'server-wins');

    expect(result.succeeded).toHaveLength(1); // Discarded counts as resolved
    expect(result.conflicts).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  it('handles 409 conflict with manual (surfaces conflict)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: 5 }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const mutations = [makeMutation({ id: 'a' })];
    const result = await replayMutations(mutations, 'manual');

    expect(result.succeeded).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].statusCode).toBe(409);

    fetchSpy.mockRestore();
  });

  it('stops on network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const mutations = [makeMutation({ id: 'a' }), makeMutation({ id: 'b' })];
    const result = await replayMutations(mutations);

    expect(result.failed).toHaveLength(1);
    expect(result.succeeded).toHaveLength(0);
    // Second mutation should not have been attempted
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  it('stops on 5xx server error', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Server Error', { status: 500 }));

    const mutations = [makeMutation({ id: 'a' }), makeMutation({ id: 'b' })];
    const result = await replayMutations(mutations);

    expect(result.failed).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockRestore();
  });

  it('coalesces mutations before replay', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const mutations = [
      makeMutation({ id: 'a', resourceId: 'posts:1', timestamp: 100 }),
      makeMutation({ id: 'b', resourceId: 'posts:1', timestamp: 200 }),
      makeMutation({ id: 'c', resourceId: 'posts:2', timestamp: 150 }),
    ];
    const result = await replayMutations(mutations);

    // Only 2 mutations replayed (posts:1 coalesced to latest)
    expect(result.succeeded).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });
});
