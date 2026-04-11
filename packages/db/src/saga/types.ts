/**
 * NeonSaga Type Definitions
 *
 * Types for the saga executor that provides transaction-like guarantees
 * over NeonDB's stateless HTTP driver using compensating actions,
 * idempotency, and the jobs table as an outbox.
 */

import type { Database } from '../client/index.js';

// =============================================================================
// Saga Context
// =============================================================================

/**
 * Context passed to each saga step's execute and compensate functions.
 * Carries the DB client and saga metadata.
 */
export interface SagaContext {
  /** Database client for executing queries */
  db: Database;
  /** Unique saga execution ID (matches the job record ID) */
  sagaId: string;
  /** Persist intermediate state to the job's JSONB data field */
  checkpoint: (stepName: string, output: unknown) => Promise<void>;
}

// =============================================================================
// Saga Steps
// =============================================================================

/**
 * A single step in a saga.
 *
 * Each step has an execute function (forward operation) and a compensate
 * function (undo/rollback). Both must be individually atomic  -  a single
 * INSERT/UPDATE/DELETE that NeonDB can execute in one HTTP request.
 */
export interface SagaStep<TOutput = unknown> {
  /** Human-readable step name for logging and checkpointing */
  name: string;

  /**
   * Execute the forward operation.
   * Must be a single atomic DB write (or read + write if idempotent).
   * Returns output that will be passed to compensate on rollback.
   */
  execute: (ctx: SagaContext) => Promise<TOutput>;

  /**
   * Undo the forward operation.
   * Receives the output from execute so it knows what to clean up.
   * Must be idempotent  -  safe to call multiple times (e.g., DELETE WHERE
   * that's a no-op if the row doesn't exist).
   */
  compensate: (ctx: SagaContext, output: TOutput) => Promise<void>;
}

// =============================================================================
// Saga Options
// =============================================================================

export interface SagaRetryOptions {
  /** Maximum retry attempts per step (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  baseDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
}

export interface SagaOptions {
  /** Retry configuration for transient step failures */
  retry?: SagaRetryOptions;
  /** Circuit breaker name from the global registry (optional) */
  circuitBreakerName?: string;
  /** Custom idempotency key (defaults to `${sagaName}:${sagaKey}`) */
  idempotencyKey?: string;
  /** TTL for idempotency key in ms (default: 24 hours) */
  idempotencyTtlMs?: number;
}

// =============================================================================
// Saga Result
// =============================================================================

export type SagaStatus = 'completed' | 'compensated' | 'failed' | 'skipped';

export interface SagaResult<T = unknown> {
  /** Job record ID */
  sagaId: string;
  /** Final saga status */
  status: SagaStatus;
  /** Output from the last step (on success) */
  result?: T;
  /** Error message (on failure) */
  error?: string;
  /** Names of steps that completed successfully */
  completedSteps: string[];
  /** Whether this execution was skipped due to idempotency */
  alreadyProcessed: boolean;
}

// =============================================================================
// Checkpoint Data (stored in jobs.data JSONB)
// =============================================================================

export interface SagaCheckpointData {
  /** Saga name for identification */
  sagaName: string;
  /** Original saga key (natural key for idempotency) */
  sagaKey: string;
  /** Step names in order */
  stepNames: string[];
  /** Steps that have completed, with their outputs */
  completedSteps: Array<{
    name: string;
    output: unknown;
    completedAt: string;
  }>;
  /** Idempotency key used for this saga */
  idempotencyKey: string;
}
