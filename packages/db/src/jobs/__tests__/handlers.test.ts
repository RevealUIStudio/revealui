import { afterEach, describe, expect, it } from 'vitest';

import type { Job } from '../../schema/jobs.js';
import { clearHandlers, getHandler, listHandlers, registerHandler } from '../handlers.js';

// The registry is module-level state. Every test must wipe it or the next one
// sees leftover registrations. Cross-file order would also leak, so the suite
// also wipes at afterEach.
afterEach(() => {
  clearHandlers();
});

// Minimal Job fixture — handler.ts only needs `name` + a Job-shaped second
// argument for the dispatch call in getHandler flow. Everything else is unused.
function fakeJob(name: string): Job {
  return {
    id: `job-${name}`,
    name,
    data: {},
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
    output: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    claimedAt: null,
    completedAt: null,
    failedAt: null,
    scheduledFor: null,
    idempotencyKey: null,
    // Drizzle generated columns that exist in the schema. Any extras are fine
    // because the handler registry never inspects them.
  } as unknown as Job;
}

describe('jobs/handlers — registry', () => {
  it('returns undefined for unknown job names', () => {
    expect(getHandler('agent.dispatch')).toBeUndefined();
  });

  it('registers and retrieves a handler by name', async () => {
    const handler = async () => ({ ok: true });
    registerHandler('agent.dispatch', handler);

    const resolved = getHandler('agent.dispatch');
    expect(resolved).toBeDefined();
    await expect(resolved?.({}, fakeJob('agent.dispatch'))).resolves.toEqual({ ok: true });
  });

  it('passes the job data and row through to the handler', async () => {
    let capturedData: Record<string, unknown> | undefined;
    let capturedJob: Job | undefined;
    const handler = async (data: Record<string, unknown>, job: Job) => {
      capturedData = data;
      capturedJob = job;
      return 'done';
    };
    registerHandler('collab.persist', handler);

    const job = fakeJob('collab.persist');
    const result = await getHandler('collab.persist')?.({ roomId: 'r1' }, job);

    expect(result).toBe('done');
    expect(capturedData).toEqual({ roomId: 'r1' });
    expect(capturedJob?.id).toBe('job-collab.persist');
  });

  it('rejects duplicate registration to prevent silent shadowing', () => {
    registerHandler('same.name', async () => 1);
    expect(() => registerHandler('same.name', async () => 2)).toThrow(
      /handler already registered for 'same.name'/,
    );
  });

  it('lists every registered handler name', () => {
    expect(listHandlers()).toEqual([]);

    registerHandler('a', async () => null);
    registerHandler('b', async () => null);
    registerHandler('c', async () => null);

    expect(listHandlers().sort()).toEqual(['a', 'b', 'c']);
  });

  it('clearHandlers wipes the registry (enables per-test isolation)', () => {
    registerHandler('a', async () => null);
    registerHandler('b', async () => null);
    expect(listHandlers()).toHaveLength(2);

    clearHandlers();
    expect(listHandlers()).toEqual([]);
    expect(getHandler('a')).toBeUndefined();
    expect(getHandler('b')).toBeUndefined();
  });

  it('allows re-registration after clear (handlers are re-entrant post-wipe)', () => {
    registerHandler('agent.dispatch', async () => 1);
    clearHandlers();
    expect(() => registerHandler('agent.dispatch', async () => 2)).not.toThrow();
    // New handler is the one that resolves now.
  });
});
