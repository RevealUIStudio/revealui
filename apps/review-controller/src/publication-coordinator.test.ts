import { EventEmitter } from 'node:events';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresPublicationCoordinator } from './publication-coordinator.js';

function fixture() {
  const client = Object.assign(new EventEmitter(), {
    query: vi.fn(async () => ({ rows: [{ unlocked: true }] })),
    release: vi.fn(),
  });
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { client, coordinator: new PostgresPublicationCoordinator(pool) };
}

describe('PostgresPublicationCoordinator', () => {
  it('holds the candidate session lock through evaluation and publication, then releases it', async () => {
    const { client, coordinator } = fixture();
    await coordinator.run(300, 7, async (assertHeld) => {
      expect(client.release).not.toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_lock(hashtextextended($1, 0))',
        ['review-controller:300:7'],
      );
      await assertHeld();
    });
    expect(client.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
      ['review-controller:300:7'],
    );
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it('destroys a failed or uncertain lock connection rather than returning it to the pool', async () => {
    const { client, coordinator } = fixture();
    client.query.mockRejectedValueOnce(new Error('query timeout'));
    const operation = vi.fn();
    await expect(coordinator.run(300, 7, operation)).rejects.toThrow('query timeout');
    expect(operation).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('blocks publication after the lock session reports a disconnect', async () => {
    const { client, coordinator } = fixture();
    const publish = vi.fn();
    await expect(
      coordinator.run(300, 7, async (assertHeld) => {
        client.emit('error', new Error('database unavailable'));
        await assertHeld();
        publish();
      }),
    ).rejects.toThrow('publication_lock_lost');
    expect(publish).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
