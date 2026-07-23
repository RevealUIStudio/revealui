/**
 * Neon-backed CircuitBreakerStore (fleet-redundancy P2-D).
 *
 * Implements the pluggable store interface from `@revealui/resilience` so
 * DbCircuitBreaker does not own a parallel persistence layer. Maps the shared
 * `circuit_breaker_state` table (Neon/Drizzle) onto CircuitBreakerSnapshot.
 */

import { getClient } from '@revealui/db';
import { circuitBreakerState } from '@revealui/db/schema';
import type { CircuitBreakerSnapshot, CircuitBreakerStore } from '@revealui/resilience';
import { eq } from 'drizzle-orm';

/**
 * Circuit breaker state store backed by the fleet Neon `circuit_breaker_state`
 * table. All API instances share the same durable view.
 */
export class NeonCircuitBreakerStore implements CircuitBreakerStore {
  async load(name: string): Promise<CircuitBreakerSnapshot | null> {
    const db = getClient();
    const [row] = await db
      .select()
      .from(circuitBreakerState)
      .where(eq(circuitBreakerState.serviceName, name));

    if (!row) return null;

    // Schema stores consecutive failures/successes in failureCount/successCount.
    return {
      state: row.state as CircuitBreakerSnapshot['state'],
      failureCount: row.failureCount,
      successCount: row.successCount,
      consecutiveFailures: row.failureCount,
      consecutiveSuccesses: row.successCount,
      lastFailureAt: row.lastFailureAt?.getTime() ?? 0,
      lastSuccessAt: 0,
      stateChangedAt: row.stateChangedAt.getTime(),
    };
  }

  async save(name: string, snapshot: CircuitBreakerSnapshot): Promise<void> {
    const now = new Date();
    const failureCount = snapshot.consecutiveFailures || snapshot.failureCount;
    const successCount = snapshot.consecutiveSuccesses || snapshot.successCount;
    const db = getClient();

    await db
      .insert(circuitBreakerState)
      .values({
        serviceName: name,
        state: snapshot.state,
        failureCount,
        successCount,
        lastFailureAt: snapshot.lastFailureAt ? new Date(snapshot.lastFailureAt) : null,
        stateChangedAt: new Date(snapshot.stateChangedAt),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: circuitBreakerState.serviceName,
        set: {
          state: snapshot.state,
          failureCount,
          successCount,
          lastFailureAt: snapshot.lastFailureAt ? new Date(snapshot.lastFailureAt) : null,
          stateChangedAt: new Date(snapshot.stateChangedAt),
          updatedAt: now,
        },
      });
  }

  async remove(name: string): Promise<boolean> {
    const db = getClient();
    // Neon HTTP client types require bare `.returning()` (no column selection map).
    const deleted = await db
      .delete(circuitBreakerState)
      .where(eq(circuitBreakerState.serviceName, name))
      .returning();
    return deleted.length > 0;
  }

  async clear(): Promise<void> {
    const db = getClient();
    await db.delete(circuitBreakerState);
  }

  async close(): Promise<void> {
    // Caller owns the shared Drizzle client lifecycle.
  }
}
