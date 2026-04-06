/**
 * @revealui/db/saga — NeonDB-safe saga executor
 *
 * Provides transaction-like guarantees over NeonDB's stateless HTTP driver
 * using compensating actions, idempotency keys, and the jobs table as outbox.
 *
 * @example
 * ```typescript
 * import { executeSaga, resilientStep, idempotentWrite } from '@revealui/db/saga';
 *
 * const result = await executeSaga(db, 'provision-license', eventId, [
 *   resilientStep({
 *     name: 'insert-license',
 *     execute: async (ctx) => { ... },
 *     compensate: async (ctx, output) => { ... },
 *   }),
 * ]);
 * ```
 */

export type { CRDTIncrementResult, CRDTSetResult } from './crdt-resolver.js';
// CRDT conflict resolution
export { crdtIncrement, crdtSetWithOptimisticLock } from './crdt-resolver.js';
export type { IdempotentWriteOptions, IdempotentWriteResult } from './idempotent-operation.js';
// Idempotent operation wrapper
export { idempotentWrite } from './idempotent-operation.js';
// Core saga executor
export { executeSaga } from './neon-saga.js';
export type { RecoveredSaga } from './recovery.js';
// Saga recovery
export { cleanupExpiredIdempotencyKeys, recoverStaleSagas } from './recovery.js';
// Resilient step wrapper
export { resilientStep } from './resilient-step.js';
// Types
export type {
  SagaCheckpointData,
  SagaContext,
  SagaOptions,
  SagaResult,
  SagaRetryOptions,
  SagaStatus,
  SagaStep,
} from './types.js';
