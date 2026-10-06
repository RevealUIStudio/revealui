import * as schema from '@revealui/db/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRestClient = vi.hoisted(() => vi.fn());

vi.mock('@revealui/db/client', () => ({
  getRestClient: () => mockGetRestClient(),
}));

import { getCollectionDatabase, withCollectionReadExecutor } from '../collectionReadExecutor';

describe('collection read executor scope', () => {
  const defaultExecutor = drizzle.mock({ schema });
  const scopedExecutor = drizzle.mock({ schema });

  beforeEach(() => {
    mockGetRestClient.mockReturnValue(defaultExecutor);
  });

  it('uses one scoped executor across awaited collection operations and restores the default', async () => {
    expect(getCollectionDatabase()).toBe(defaultExecutor);

    await withCollectionReadExecutor(scopedExecutor, async () => {
      expect(getCollectionDatabase()).toBe(scopedExecutor);
      await Promise.resolve();
      expect(getCollectionDatabase()).toBe(scopedExecutor);
    });

    expect(getCollectionDatabase()).toBe(defaultExecutor);
  });

  it('restores the default executor when the scoped operation fails', async () => {
    await expect(
      withCollectionReadExecutor(scopedExecutor, async () => {
        throw new Error('collection query failed');
      }),
    ).rejects.toThrow('collection query failed');

    expect(getCollectionDatabase()).toBe(defaultExecutor);
  });
});
