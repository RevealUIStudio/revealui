/**
 * NeonSaga — Saga Executor for NeonDB HTTP Driver
 *
 * Provides transaction-like guarantees over NeonDB's stateless HTTP driver
 * by modeling multi-step writes as a saga with compensating actions.
 *
 * Each step's execute() and compensate() must be individually atomic (single
 * DB statement). The saga tracks progress via the jobs table as an outbox,
 * enabling crash recovery and idempotent replay.
 *
 * @example
 * ```typescript
 * const result = await executeSaga(db, 'provision-license', eventId, [
 *   {
 *     name: 'insert-license',
 *     execute: async (ctx) => {
 *       const [row] = await ctx.db.insert(licenses).values({ ... }).returning();
 *       return row;
 *     },
 *     compensate: async (ctx, row) => {
 *       await ctx.db.delete(licenses).where(eq(licenses.id, row.id));
 *     },
 *   },
 *   {
 *     name: 'activate-subscription',
 *     execute: async (ctx) => {
 *       await ctx.db.update(subscriptions).set({ status: 'active' }).where(...);
 *       return { previousStatus: 'pending' };
 *     },
 *     compensate: async (ctx, output) => {
 *       await ctx.db.update(subscriptions).set({ status: output.previousStatus }).where(...);
 *     },
 *   },
 * ]);
 * ```
 */

import { eq } from 'drizzle-orm';
import { idempotencyKeys } from '../schema/idempotency.js';
import { jobs } from '../schema/jobs.js';
import type {
  SagaCheckpointData,
  SagaContext,
  SagaOptions,
  SagaResult,
  SagaStep,
} from './types.js';

// Default idempotency TTL: 24 hours
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Execute a saga — a sequence of individually-atomic steps with compensating
 * actions for rollback.
 *
 * @param db - Database client (works with both NeonDB HTTP and pg Pool)
 * @param sagaName - Saga type identifier (e.g., 'provision-license')
 * @param sagaKey - Natural idempotency key (e.g., Stripe event ID)
 * @param steps - Ordered list of saga steps
 * @param options - Optional retry, circuit breaker, and idempotency config
 * @returns SagaResult with status, outputs, and completed steps
 */
export async function executeSaga<T = unknown>(
  db: Parameters<SagaStep['execute']>[0]['db'],
  sagaName: string,
  sagaKey: string,
  steps: SagaStep[],
  options?: SagaOptions,
): Promise<SagaResult<T>> {
  const idempotencyKey = options?.idempotencyKey ?? `${sagaName}:${sagaKey}`;
  const sagaId = `saga-${sagaName}-${sagaKey}-${Date.now()}`;

  // -------------------------------------------------------------------------
  // 1. Idempotency check — skip if already processed
  // -------------------------------------------------------------------------
  const alreadyProcessed = await checkIdempotency(db, idempotencyKey);
  if (alreadyProcessed) {
    return {
      sagaId,
      status: 'skipped',
      completedSteps: [],
      alreadyProcessed: true,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Create job record (outbox entry) — records intent before mutations
  // -------------------------------------------------------------------------
  const checkpointData: SagaCheckpointData = {
    sagaName,
    sagaKey,
    stepNames: steps.map((s) => s.name),
    completedSteps: [],
    idempotencyKey,
  };

  await db.insert(jobs).values({
    id: sagaId,
    name: `saga:${sagaName}`,
    data: checkpointData as unknown as Record<string, unknown>,
    state: 'created',
    priority: 0,
    retryCount: 0,
    retryLimit: 3,
  });

  // Mark job active
  await db.update(jobs).set({ state: 'active', startedAt: new Date() }).where(eq(jobs.id, sagaId));

  // -------------------------------------------------------------------------
  // 3. Execute steps sequentially with checkpointing
  // -------------------------------------------------------------------------
  const completedSteps: Array<{ name: string; output: unknown; completedAt: string }> = [];
  let lastOutput: unknown;

  const ctx: SagaContext = {
    db,
    sagaId,
    checkpoint: async (stepName: string, output: unknown) => {
      const entry = {
        name: stepName,
        output,
        completedAt: new Date().toISOString(),
      };
      completedSteps.push(entry);

      // Persist checkpoint to job's JSONB data
      await db
        .update(jobs)
        .set({
          data: {
            ...checkpointData,
            completedSteps: [...completedSteps],
          } as unknown as Record<string, unknown>,
        })
        .where(eq(jobs.id, sagaId));
    },
  };

  try {
    for (const step of steps) {
      const output = await step.execute(ctx);
      await ctx.checkpoint(step.name, output);
      lastOutput = output;
    }

    // -----------------------------------------------------------------------
    // 4. All steps succeeded — mark completed and record idempotency key
    // -----------------------------------------------------------------------
    await db
      .update(jobs)
      .set({ state: 'completed', completedAt: new Date() })
      .where(eq(jobs.id, sagaId));

    await recordIdempotency(
      db,
      idempotencyKey,
      'saga',
      options?.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
    );

    return {
      sagaId,
      status: 'completed',
      result: lastOutput as T,
      completedSteps: completedSteps.map((s) => s.name),
      alreadyProcessed: false,
    };
  } catch (executeError) {
    // -----------------------------------------------------------------------
    // 5. Step failed — compensate completed steps in reverse order
    // -----------------------------------------------------------------------
    const errorMessage =
      executeError instanceof Error ? executeError.message : String(executeError);

    const compensationErrors: string[] = [];

    // Compensate in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const completed = completedSteps[i];
      if (!completed) continue;
      const step = steps.find((s) => s.name === completed.name);
      if (!step) continue;

      try {
        await step.compensate(ctx, completed.output);
      } catch (compensateError) {
        // Log but don't throw — compensations are best-effort
        const msg =
          compensateError instanceof Error ? compensateError.message : String(compensateError);
        compensationErrors.push(`${completed.name}: ${msg}`);
      }
    }

    // Determine final status
    const finalStatus = compensationErrors.length > 0 ? 'failed' : 'compensated';

    // Update job record with failure info
    await db
      .update(jobs)
      .set({
        state: 'failed',
        output: {
          error: errorMessage,
          compensationErrors: compensationErrors.length > 0 ? compensationErrors : undefined,
          compensatedSteps: completedSteps.map((s) => s.name),
        } as Record<string, unknown>,
      })
      .where(eq(jobs.id, sagaId));

    return {
      sagaId,
      status: finalStatus,
      error: errorMessage,
      completedSteps: completedSteps.map((s) => s.name),
      alreadyProcessed: false,
    };
  }
}

// =============================================================================
// Idempotency Helpers
// =============================================================================

/**
 * Check if an idempotency key has already been recorded.
 * Returns true if the key exists and hasn't expired.
 */
async function checkIdempotency(
  db: Parameters<SagaStep['execute']>[0]['db'],
  key: string,
): Promise<boolean> {
  try {
    const rows = await db
      .select({ key: idempotencyKeys.key, expiresAt: idempotencyKeys.expiresAt })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);

    if (rows.length === 0) return false;

    const expiresAt = rows[0]?.expiresAt;
    if (expiresAt && expiresAt < new Date()) {
      // Expired — delete and treat as not processed
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      return false;
    }

    return true;
  } catch {
    // If the idempotency table doesn't exist yet, treat as not processed
    return false;
  }
}

/**
 * Record an idempotency key after successful saga completion.
 */
async function recordIdempotency(
  db: Parameters<SagaStep['execute']>[0]['db'],
  key: string,
  operationType: string,
  ttlMs: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    await db
      .insert(idempotencyKeys)
      .values({
        key,
        operationType,
        createdAt: new Date(),
        expiresAt,
      })
      .onConflictDoNothing();
  } catch {
    // Best-effort — if this fails, the saga still completed successfully.
    // The next execution will just re-run (which is fine since steps are idempotent).
  }
}
