import type { PublicationCoordinator } from '../publication-coordinator.js';

/** Test-only model of the cross-process lock; production uses PostgreSQL. */
export function createTestPublicationCoordinator(): PublicationCoordinator {
  const pending = new Map<string, Promise<void>>();
  return {
    async run(repositoryId, pullRequest, operation) {
      const key = `${repositoryId}:${pullRequest}`;
      const previous = pending.get(key) ?? Promise.resolve();
      let release = () => {};
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      pending.set(key, current);
      await previous;
      try {
        return await operation(async () => undefined);
      } finally {
        release();
        if (pending.get(key) === current) pending.delete(key);
      }
    },
  };
}

/** A test-only generation model. PostgreSQL tests exercise the actual authority. */
export function createTestReceiptAuthority() {
  let generation = 0;
  return {
    async begin() {
      return ++generation;
    },
    async approve(input: { generation: number }) {
      return input.generation === generation;
    },
    async revoke(_repositoryId: number, _pullRequest: number, current: number) {
      return current === generation;
    },
    async expire() {
      generation++;
      return true;
    },
  };
}
