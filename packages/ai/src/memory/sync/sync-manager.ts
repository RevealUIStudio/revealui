/**
 * CRDT Sync Manager
 *
 * Coordinates state synchronization between distributed nodes.
 * Supports both full-state merge and delta-based sync via the operation log.
 *
 * Architecture:
 * - State-based sync: serialize → transfer → merge (simple, higher bandwidth)
 * - Op-based sync: log ops → transfer deltas → replay (efficient, requires op log)
 * - Anti-entropy: periodic full-state reconciliation to catch missed ops
 *
 * Transport-agnostic: the SyncManager produces/consumes serialized payloads.
 * The actual transport (HTTP, WebSocket, message queue) is the caller's concern.
 */

import type { LWWRegisterData } from '../crdt/lww-register.js';
import type { ORSetData } from '../crdt/or-set.js';
import type { PNCounterData } from '../crdt/pn-counter.js';
import type {
  CRDTOperationPayload,
  CRDTPersistence,
  CRDTType,
} from '../persistence/crdt-persistence.js';
import type { WorkingMemory } from '../stores/working-memory.js';

// =============================================================================
// Types
// =============================================================================

export interface SyncState {
  /** CRDT instance identifier */
  crdtId: string;
  /** Node that produced this state */
  sourceNodeId: string;
  /** Timestamp of this state snapshot */
  timestamp: number;
  /** Serialized CRDT states (composite) */
  states: Record<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>;
}

export interface SyncDelta {
  /** CRDT instance identifier */
  crdtId: string;
  /** Node that produced these operations */
  sourceNodeId: string;
  /** Operations since last sync point */
  operations: CRDTOperationPayload[];
  /** Timestamp of the last synced operation (for next delta request) */
  lastSyncTimestamp: number;
}

export interface SyncResult {
  /** Whether state changed as a result of sync */
  changed: boolean;
  /** Number of operations applied */
  operationsApplied: number;
  /** Number of conflicts resolved */
  conflictsResolved: number;
  /** Timestamp to use for next delta sync */
  syncTimestamp: number;
}

// =============================================================================
// SyncManager
// =============================================================================

export class SyncManager {
  private nodeId: string;
  private persistence: CRDTPersistence;
  /** Tracks the last sync timestamp per remote node */
  private syncPoints: Map<string, number> = new Map();

  constructor(nodeId: string, persistence: CRDTPersistence) {
    this.nodeId = nodeId;
    this.persistence = persistence;
  }

  /**
   * Produces a full-state snapshot for transfer to another node.
   * The receiving node calls `mergeRemoteState()` with this payload.
   */
  async getLocalState(crdtId: string): Promise<SyncState> {
    const states = await this.persistence.loadCompositeState(crdtId);
    const stateRecord: Record<
      string,
      LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData
    > = {};

    for (const [key, data] of states) {
      stateRecord[key] = data;
    }

    return {
      crdtId,
      sourceNodeId: this.nodeId,
      timestamp: Date.now(),
      states: stateRecord,
    };
  }

  /**
   * Merges a remote node's full state into local state.
   * Uses CRDT merge semantics  -  order doesn't matter, result is deterministic.
   *
   * @returns WorkingMemory with merged state (caller decides whether to persist)
   */
  mergeRemoteWorkingMemory(
    local: WorkingMemory,
    remote: WorkingMemory,
  ): { merged: WorkingMemory; changed: boolean } {
    const localData = local.toData();
    const remoteData = remote.toData();

    // Quick equality check  -  if timestamps match, nothing changed
    if (
      localData.context.timestamp === remoteData.context.timestamp &&
      localData.sessionState.timestamp === remoteData.sessionState.timestamp
    ) {
      return { merged: local, changed: false };
    }

    const merged = local.merge(remote);
    return { merged, changed: true };
  }

  /**
   * Produces a delta payload (operations since a timestamp) for efficient sync.
   * The receiving node calls `applyDelta()` with this payload.
   */
  async getDelta(crdtId: string, since: number): Promise<SyncDelta> {
    const operations = await this.persistence.getOperationsSince(crdtId, since);

    return {
      crdtId,
      sourceNodeId: this.nodeId,
      operations,
      lastSyncTimestamp:
        operations.length > 0 ? (operations[operations.length - 1]?.timestamp ?? since) : since,
    };
  }

  /**
   * Applies a delta from a remote node by replaying operations.
   * Logs each remote operation locally for future delta requests from other nodes.
   */
  async applyDelta(delta: SyncDelta): Promise<SyncResult> {
    let applied = 0;

    for (const op of delta.operations) {
      // Skip operations from our own node (already applied locally)
      if (op.nodeId === this.nodeId) {
        continue;
      }

      // Log the remote operation locally
      await this.persistence.appendOperation(op);
      applied++;
    }

    // Update sync point for this remote node
    this.syncPoints.set(delta.sourceNodeId, delta.lastSyncTimestamp);

    return {
      changed: applied > 0,
      operationsApplied: applied,
      conflictsResolved: 0, // CRDTs resolve conflicts automatically
      syncTimestamp: delta.lastSyncTimestamp,
    };
  }

  /**
   * Logs a local operation to the persistence layer.
   * Called by memory stores when they mutate CRDT state.
   */
  async logOperation(
    crdtId: string,
    crdtType: CRDTType,
    operationType: CRDTOperationPayload['operationType'],
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.persistence.appendOperation({
      crdtId,
      crdtType,
      operationType,
      payload,
      nodeId: this.nodeId,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets the last sync timestamp for a remote node.
   * Used to request only new operations on the next sync.
   */
  getSyncPoint(remoteNodeId: string): number {
    return this.syncPoints.get(remoteNodeId) ?? 0;
  }

  /**
   * Sets the sync point for a remote node (e.g., after initial full-state sync).
   */
  setSyncPoint(remoteNodeId: string, timestamp: number): void {
    this.syncPoints.set(remoteNodeId, timestamp);
  }

  /**
   * Gets all tracked sync points.
   */
  getAllSyncPoints(): Map<string, number> {
    return new Map(this.syncPoints);
  }

  /**
   * Gets this manager's node ID.
   */
  getNodeId(): string {
    return this.nodeId;
  }
}
