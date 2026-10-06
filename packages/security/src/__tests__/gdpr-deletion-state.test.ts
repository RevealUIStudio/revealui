import { describe, expect, it, vi } from 'vitest';
import { DataDeletionSystem } from '../gdpr.js';
import { InMemoryGDPRStorage } from '../gdpr-storage.js';

describe('deletion request processing ownership', () => {
  it('allows only one concurrent processor to execute deletion', async () => {
    const storage = new InMemoryGDPRStorage();
    const first = new DataDeletionSystem(storage);
    const second = new DataDeletionSystem(storage);
    const request = await first.requestDeletion('user-1', ['personal']);
    const callback = vi.fn(async () => ({ deleted: ['profile'], retained: [] }));
    const results = await Promise.allSettled([
      first.processDeletion(request.id, callback),
      second.processDeletion(request.id, callback),
    ]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await first.getRequest(request.id))?.status).toBe('completed');
  });

  it('does not reprocess or overwrite a completed request', async () => {
    const system = new DataDeletionSystem(new InMemoryGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    await system.processDeletion(request.id, async () => ({ deleted: ['profile'], retained: [] }));
    const callback = vi.fn(async () => {
      throw new Error('must not execute');
    });
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect((await system.getRequest(request.id))?.status).toBe('completed');
  });

  it('does not implicitly retry a failed request', async () => {
    const system = new DataDeletionSystem(new InMemoryGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    await expect(
      system.processDeletion(request.id, async () => {
        throw new Error('required step failed');
      }),
    ).rejects.toThrow('required step failed');
    const callback = vi.fn(async () => ({ deleted: [], retained: [] }));
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect((await system.getRequest(request.id))?.status).toBe('failed');
  });
});

describe('in-memory deletion transition isolation', () => {
  it('does not expose mutable storage references', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    request.status = 'completed';
    request.dataCategories.push('financial');
    const read = await system.getRequest(request.id);
    if (!read) throw new Error('Expected saved request');
    read.status = 'completed';
    expect(await storage.claimDeletionRequest(request.id)).toMatchObject({
      status: 'processing',
      dataCategories: ['personal'],
    });
    const terminal = {
      status: 'completed',
      processedAt: new Date().toISOString(),
    } satisfies Parameters<typeof storage.finishDeletionRequest>[1];
    expect(await storage.finishDeletionRequest(request.id, terminal)).toBe(true);
    expect(await storage.finishDeletionRequest(request.id, { ...terminal, status: 'failed' })).toBe(
      false,
    );
    expect((await system.getRequest(request.id))?.status).toBe('completed');
  });
});

describe('public deletion input validation', () => {
  it('rejects an invalid runtime category before creating a request', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    // @ts-expect-error -- JavaScript callers can supply invalid category values.
    await expect(system.requestDeletion('user-1', ['invalid'])).rejects.toThrow(
      'Invalid deletion category',
    );
    expect(await storage.getDeletionRequestsByUser('user-1')).toEqual([]);
  });

  it('rejects missing user identity before creating a request', async () => {
    const system = new DataDeletionSystem(new InMemoryGDPRStorage());
    await expect(system.requestDeletion(' ', ['personal'])).rejects.toThrow(
      'Invalid deletion user ID',
    );
  });

  it('reports loss of processing state rather than success', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    vi.spyOn(storage, 'finishDeletionRequest').mockResolvedValue(false);
    await expect(
      system.processDeletion(request.id, async () => ({ deleted: [], retained: [] })),
    ).rejects.toThrow('ownership lost');
    expect((await system.getRequest(request.id))?.status).toBe('processing');
  });

  it('preserves callback failure when persisting its failure also fails', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    const callbackError = new Error('required erasure failed');
    const persistenceError = new Error('database unavailable');
    vi.spyOn(storage, 'finishDeletionRequest').mockRejectedValue(persistenceError);
    await expect(
      system.processDeletion(request.id, async () => {
        throw callbackError;
      }),
    ).rejects.toMatchObject({
      message: 'Unable to persist failed deletion request',
      errors: [callbackError, persistenceError],
    });
  });
});

describe('completion payload validation', () => {
  it('rejects invalid result data before a terminal transition', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    await storage.claimDeletionRequest(request.id);
    const result = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      deletedData: ['profile'],
    } satisfies Parameters<typeof storage.finishDeletionRequest>[1];
    Object.defineProperty(result.deletedData, '0', { value: 42 });
    await expect(storage.finishDeletionRequest(request.id, result)).rejects.toThrow(
      'Invalid deletion result data',
    );
    expect((await storage.getDeletionRequest(request.id))?.status).toBe('processing');
  });

  it('cannot change identity through extra completion fields', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    await storage.claimDeletionRequest(request.id);
    const result = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      id: 'other-request',
      userId: 'other-user',
      dataCategories: ['financial'],
    } satisfies Parameters<typeof storage.finishDeletionRequest>[1] & {
      id: string;
      userId: string;
      dataCategories: string[];
    };
    expect(await storage.finishDeletionRequest(request.id, result)).toBe(true);
    expect(await storage.getDeletionRequest(request.id)).toMatchObject({
      id: request.id,
      userId: 'user-1',
      dataCategories: ['personal'],
      status: 'completed',
    });
  });
});

describe('callback outcome and completion persistence', () => {
  it('records malformed callback data as failed', async () => {
    const system = new DataDeletionSystem(new InMemoryGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    const outcome = { deleted: ['profile'], retained: [] };
    Object.defineProperty(outcome, 'deleted', { value: 42 });
    await expect(system.processDeletion(request.id, async () => outcome)).rejects.toThrow(
      'Invalid deletion result data',
    );
    expect((await system.getRequest(request.id))?.status).toBe('failed');
  });

  it('requires both callback result arrays before recording completion', async () => {
    const system = new DataDeletionSystem(new InMemoryGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    const outcome = { deleted: ['profile'], retained: [] };
    Reflect.deleteProperty(outcome, 'retained');
    await expect(system.processDeletion(request.id, async () => outcome)).rejects.toThrow(
      'Invalid deletion callback result',
    );
    expect((await system.getRequest(request.id))?.status).toBe('failed');
  });

  it('does not rerun effects or rewrite failure when completion persistence fails', async () => {
    const storage = new InMemoryGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    const finish = vi
      .spyOn(storage, 'finishDeletionRequest')
      .mockRejectedValue(new Error('completion persistence failed'));
    const callback = vi.fn(async () => ({ deleted: ['profile'], retained: [] }));
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow(
      'completion persistence failed',
    );
    expect(finish).toHaveBeenCalledTimes(1);
    expect((await system.getRequest(request.id))?.status).toBe('processing');
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow('not pending');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
