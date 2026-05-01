/**
 * Provenance logger for collab edits.
 *
 * Writes each Yjs edit directly to the `collab_edits` table. Fire-and-forget
 * from the caller's perspective (logEdit returns void), but durable once the
 * DB insert starts — a pod crash can drop at most the in-flight edits (the
 * ones whose `await db.insert(...)` hasn't resolved yet).
 *
 * Historical note (CR8-P2-01 phase D, pre-2026-04-22): this file used to
 * buffer entries in memory and flush every 5 s / 50 entries via setInterval.
 * The buffer was a latent data-loss window — any unflushed entry was lost
 * on pod crash, and an insert failure pushed entries back into the buffer
 * only to be retried on the next setInterval tick (so the retry vanished
 * too if the process died between ticks). Direct-write has strictly
 * stricter durability semantics: a failure loses one edit, not up to
 * BATCH_SIZE_LIMIT.
 *
 * Wrapping this in the durable work queue (phase C primitive) is NOT the
 * right fix — the queue would pay a job-row write per edit AND still
 * require the edit payload to be durable when the queue's producer
 * fires. Direct-write is the queue's successor, not its predecessor.
 */

import { collabEdits } from '@revealui/db/schema/collab-edits';
import type { ClientIdentity } from './room-manager.js';

interface DrizzleDb {
  insert(table: unknown): {
    values(data: unknown[]): Promise<unknown>;
  };
}

export interface ProvenanceLogger {
  logEdit(documentId: string, identity: ClientIdentity, update: Uint8Array): void;
  /**
   * Waits for every in-flight insert to resolve. Called at shutdown, on
   * explicit drain requests, and inside destroy(). No-op when nothing is
   * in flight.
   */
  flush(): Promise<void>;
  /** Marks the logger destroyed; subsequent logEdit calls are dropped. */
  destroy(): Promise<void>;
}

export function createProvenanceLogger(db: DrizzleDb): ProvenanceLogger {
  const inFlight = new Set<Promise<unknown>>();
  let destroyed = false;

  function writeEntry(row: {
    documentId: string;
    clientType: 'human' | 'agent';
    clientId: string;
    clientName: string;
    agentModel: string | null;
    updateData: Buffer;
    updateSize: number;
    timestamp: Date;
  }): void {
    const promise = db.insert(collabEdits).values([row]);
    inFlight.add(promise);
    promise
      .catch(() => {
        // Best-effort: a failed insert is lost. Matches the previous
        // fire-and-forget semantics (the buffered version would have
        // retried once and then lost the entry on next setInterval
        // crash). Logging is intentionally absent — log noise from a
        // transient DB blip on every collab keystroke would swamp app
        // logs; consider upgrading to sampled logging if this path
        // becomes load-bearing.
      })
      .finally(() => {
        inFlight.delete(promise);
      });
  }

  return {
    logEdit(documentId: string, identity: ClientIdentity, update: Uint8Array): void {
      if (destroyed) return;
      writeEntry({
        documentId,
        clientType: identity.type,
        clientId: identity.id,
        clientName: identity.name,
        agentModel: identity.agentModel ?? null,
        updateData: Buffer.from(update),
        updateSize: update.byteLength,
        timestamp: new Date(),
      });
    },

    async flush(): Promise<void> {
      if (inFlight.size === 0) return;
      // Snapshot the current in-flight set — new inserts added during
      // the await won't block flush() from returning. Callers that need
      // "quiet-period drain" should pause upstream writes first.
      await Promise.allSettled([...inFlight]);
    },

    async destroy(): Promise<void> {
      destroyed = true;
      if (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
      }
    },
  };
}
