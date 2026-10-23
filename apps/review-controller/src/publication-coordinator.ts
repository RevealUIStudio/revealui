import type { Pool } from 'pg';

export interface PublicationCoordinator {
  run<T>(
    repositoryId: number,
    pullRequest: number,
    operation: (assertHeld: () => Promise<void>) => Promise<T>,
  ): Promise<T>;
}

/** Session locks serialize the whole candidate operation across worker processes.
 * Use a dedicated max:1 pool, so lock waiters cannot starve evidence-store work.
 */
export class PostgresPublicationCoordinator implements PublicationCoordinator {
  constructor(private readonly pool: Pick<Pool, 'connect'>) {}

  async run<T>(
    repositoryId: number,
    pullRequest: number,
    operation: (assertHeld: () => Promise<void>) => Promise<T>,
  ): Promise<T> {
    if (
      !Number.isSafeInteger(repositoryId) ||
      repositoryId <= 0 ||
      !Number.isSafeInteger(pullRequest) ||
      pullRequest <= 0
    )
      throw new Error('publication_candidate_invalid');
    const key = `review-controller:${repositoryId}:${pullRequest}`;
    const client = await this.pool.connect();
    let lost = false;
    let acquired = false;
    const disconnected = () => {
      lost = true;
    };
    client.on('error', disconnected);
    const assertHeld = async () => {
      if (!acquired || lost) throw new Error('publication_lock_lost');
      await client.query('SELECT 1');
      if (lost) throw new Error('publication_lock_lost');
    };
    try {
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key]);
      acquired = true;
      await assertHeld();
      const result = await operation(assertHeld);
      await assertHeld();
      return result;
    } catch (error) {
      lost = true;
      throw error;
    } finally {
      try {
        if (acquired && !lost) {
          const released = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
            [key],
          );
          if (released.rows[0]?.unlocked !== true) lost = true;
        }
      } catch {
        lost = true;
      } finally {
        client.off('error', disconnected);
        client.release(lost);
      }
    }
  }
}
