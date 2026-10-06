import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DataDeletionSystem } from '@revealui/core/security';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('@revealui/db', () => ({ getClient }));

import { DrizzleGDPRStorage } from '../drizzle-gdpr-storage.js';

const client = new PGlite();
const db = drizzle(client);
beforeAll(async () => {
  const initial = await readFile(
    new URL('../../../../../packages/db/migrations/0000_init.sql', import.meta.url),
    'utf8',
  );
  const constraints = await readFile(
    new URL('../../../../../packages/db/migrations/0001_special_logan.sql', import.meta.url),
    'utf8',
  );
  for (const text of [initial, constraints]) {
    const statement = text
      .split('--> statement-breakpoint')
      .find(
        (part) =>
          part.includes('"gdpr_deletion_requests"') &&
          (part.includes('CREATE TABLE') || part.includes('ADD CONSTRAINT')),
      );
    if (!statement) throw new Error('Missing GDPR migration statement');
    await client.exec(statement);
  }
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  getClient.mockReturnValue(db);
  await client.exec('DELETE FROM gdpr_deletion_requests');
});

describe('persisted deletion processing ownership', () => {
  it('allows one processor across separate system and storage instances', async () => {
    const first = new DataDeletionSystem(new DrizzleGDPRStorage());
    const second = new DataDeletionSystem(new DrizzleGDPRStorage());
    const request = await first.requestDeletion('user-1', ['personal']);
    const callback = vi.fn(async () => ({ deleted: ['profile'], retained: ['billing_records'] }));
    const results = await Promise.allSettled([
      first.processDeletion(request.id, callback),
      second.processDeletion(request.id, callback),
    ]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await first.getRequest(request.id))?.status).toBe('completed');
  });

  it('preserves terminal state against a subsequent processor', async () => {
    const system = new DataDeletionSystem(new DrizzleGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    await system.processDeletion(request.id, async () => ({ deleted: ['profile'], retained: [] }));
    const callback = vi.fn(async () => {
      throw new Error('must not execute');
    });
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect((await system.getRequest(request.id))?.status).toBe('completed');
  });

  it('rejects corrupt persisted categories before invoking deletion', async () => {
    const system = new DataDeletionSystem(new DrizzleGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    await client.query('UPDATE gdpr_deletion_requests SET data_categories=$1 WHERE id=$2', [
      '["not-a-category"]',
      request.id,
    ]);
    const callback = vi.fn(async () => ({ deleted: [], retained: [] }));
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect(
      (await client.query('SELECT status FROM gdpr_deletion_requests WHERE id=$1', [request.id]))
        .rows,
    ).toEqual([{ status: 'pending' }]);
  });
});

describe('persisted deletion transition invariants', () => {
  it('allows only one terminal result and never overwrites it', async () => {
    const storage = new DrizzleGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    expect(
      await storage.finishDeletionRequest(request.id, {
        status: 'completed',
        processedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    expect(await storage.claimDeletionRequest(request.id)).toMatchObject({ status: 'processing' });
    const results = await Promise.all([
      storage.finishDeletionRequest(request.id, {
        status: 'completed',
        processedAt: new Date().toISOString(),
        deletedData: ['profile'],
      }),
      storage.finishDeletionRequest(request.id, {
        status: 'failed',
        processedAt: new Date().toISOString(),
      }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const terminal = await storage.getDeletionRequest(request.id);
    expect(
      await storage.finishDeletionRequest(request.id, {
        status: 'failed',
        processedAt: new Date().toISOString(),
      }),
    ).toBe(false);
    await expect(storage.setDeletionRequest(request)).rejects.toThrow();
    expect(await storage.getDeletionRequest(request.id)).toEqual(terminal);
  });

  it('records a required callback failure without reporting completion or replaying effects', async () => {
    const system = new DataDeletionSystem(new DrizzleGDPRStorage());
    const request = await system.requestDeletion('user-1', ['personal']);
    const callback = vi.fn(async () => {
      throw new Error('required external step failed');
    });
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow(
      'required external step failed',
    );
    const failed = await system.getRequest(request.id);
    expect(failed?.status).toBe('failed');
    expect(typeof failed?.processedAt).toBe('string');
    await expect(system.processDeletion(request.id, callback)).rejects.toThrow('not pending');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each(['{}', 'null', '[1]', '[null]'])(
    'rejects malformed persisted categories %s before deletion',
    async (categories) => {
      const system = new DataDeletionSystem(new DrizzleGDPRStorage());
      const request = await system.requestDeletion('user-1', ['personal']);
      await client.query('UPDATE gdpr_deletion_requests SET data_categories=$1 WHERE id=$2', [
        categories,
        request.id,
      ]);
      const callback = vi.fn(async () => ({ deleted: [], retained: [] }));
      await expect(system.processDeletion(request.id, callback)).rejects.toThrow();
      expect(callback).not.toHaveBeenCalled();
      expect(
        (await client.query('SELECT status FROM gdpr_deletion_requests WHERE id=$1', [request.id]))
          .rows,
      ).toEqual([{ status: 'pending' }]);
    },
  );
});

describe('persisted completion validation', () => {
  it('rejects malformed result data without changing processing state', async () => {
    const storage = new DrizzleGDPRStorage();
    const system = new DataDeletionSystem(storage);
    const request = await system.requestDeletion('user-1', ['personal']);
    await storage.claimDeletionRequest(request.id);
    const result = {
      status: 'completed',
      processedAt: new Date().toISOString(),
      retainedData: ['billing_records'],
    } satisfies Parameters<typeof storage.finishDeletionRequest>[1];
    Object.defineProperty(result, 'retainedData', { value: { invalid: true } });
    await expect(storage.finishDeletionRequest(request.id, result)).rejects.toThrow(
      'Invalid deletion result data',
    );
    expect((await system.getRequest(request.id))?.status).toBe('processing');
  });
});
