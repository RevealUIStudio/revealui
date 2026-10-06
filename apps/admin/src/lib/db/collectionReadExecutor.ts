import { AsyncLocalStorage } from 'node:async_hooks';
import { type Database, getRestClient } from '@revealui/db/client';

const collectionReadExecutor = new AsyncLocalStorage<Database>();

export function getCollectionDatabase(): Database {
  return collectionReadExecutor.getStore() ?? getRestClient();
}

export function withCollectionReadExecutor<T>(
  executor: Database,
  callback: () => Promise<T>,
): Promise<T> {
  return collectionReadExecutor.run(executor, callback);
}
