/**
 * CRDT Persistence Adapter
 *
 * Generic adapter for saving/loading CRDT state to/from database.
 * Supports both state-based (JSONB) and operation-based (operations log) storage.
 */

import { randomUUID } from 'node:crypto';
import type { Database } from '@revealui/db/client';
import { agentContexts, crdtOperations } from '@revealui/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { LWWRegister, type LWWRegisterData } from '../crdt/lww-register.js';
import { ORSet, type ORSetData } from '../crdt/or-set.js';
import { PNCounter, type PNCounterData } from '../crdt/pn-counter.js';
import { findAgentContextById } from '../utils/sql-helpers.js';

// =============================================================================
// Types
// =============================================================================

export type CRDTType = 'lww_register' | 'or_set' | 'pn_counter';
export type CRDTOperationType = 'set' | 'add' | 'remove' | 'increment' | 'decrement';

export interface CRDTOperationPayload {
  crdtId: string;
  crdtType: CRDTType;
  operationType: CRDTOperationType;
  payload: Record<string, unknown>;
  nodeId: string;
  timestamp: number;
}

export interface CRDTStateData {
  lww_register?: LWWRegisterData<unknown>;
  or_set?: ORSetData<unknown>;
  pn_counter?: PNCounterData;
}

// =============================================================================
// CRDT Persistence
// =============================================================================

/**
 * Persistence adapter for CRDT operations.
 *
 * Supports:
 * - State-based storage (JSONB in existing tables)
 * - Operation-based storage (crdt_operations table)
 */
export class CRDTPersistence {
  constructor(private db: Database) {}

  /**
   * Saves CRDT state to database (state-based approach).
   * Stores serialized CRDT data in JSONB field.
   *
   * @param crdtId - Unique identifier for this CRDT instance
   * @param type - Type of CRDT
   * @param data - Serialized CRDT data
   * @param table - Table to store in (default: agentContexts)
   * @param field - JSONB field name (default: 'context')
   */
  async saveCRDTState(
    crdtId: string,
    type: CRDTType,
    data: LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData,
    _table: 'agentContexts' = 'agentContexts',
    _field: string = 'context',
  ): Promise<void> {
    void _table;
    void _field;
    // For now, we'll store in agentContexts.context JSONB field
    // This is a simplified state-based approach
    const stateData: CRDTStateData = {
      [type]: data,
    };

    // Check if context exists (using raw SQL for Neon HTTP compatibility)
    const existing = await findAgentContextById(this.db, crdtId);

    if (existing) {
      // Update existing context
      const currentContext = (existing.context as Record<string, unknown>) || {};
      await this.db
        .update(agentContexts)
        .set({
          context: {
            ...currentContext,
            _crdt: stateData,
          },
          updatedAt: new Date(),
        })
        .where(eq(agentContexts.id, crdtId));
    } else {
      // Create new context entry
      await this.db.insert(agentContexts).values({
        id: crdtId,
        version: 1,
        sessionId: crdtId.split(':')[0] || '',
        agentId: crdtId.split(':')[1] || '',
        context: {
          _crdt: stateData,
        },
        priority: 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Loads CRDT state from database (state-based approach).
   *
   * @param crdtId - Unique identifier for this CRDT instance
   * @param type - Type of CRDT to load
   * @returns Serialized CRDT data or null if not found
   */
  async loadCRDTState(
    crdtId: string,
    type: CRDTType,
  ): Promise<LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData | null> {
    const context = await findAgentContextById(this.db, crdtId);

    if (!context?.context) {
      return null;
    }

    const contextData = context.context as Record<string, unknown>;
    const crdtData = contextData._crdt as CRDTStateData | undefined;

    if (!crdtData?.[type]) {
      return null;
    }

    return crdtData[type];
  }

  /**
   * Appends an operation to the CRDT operations log.
   *
   * @param operation - The operation to append
   */
  async appendOperation(operation: CRDTOperationPayload): Promise<void> {
    await this.db.insert(crdtOperations).values({
      id: randomUUID(),
      crdtId: operation.crdtId,
      crdtType: operation.crdtType,
      operationType: operation.operationType,
      payload: operation.payload,
      nodeId: operation.nodeId,
      timestamp: operation.timestamp,
    });
  }

  /**
   * Gets operations since a given timestamp (for sync).
   *
   * @param crdtId - CRDT instance identifier
   * @param since - Unix timestamp (milliseconds) to get operations since
   * @returns Array of operations
   */
  async getOperationsSince(crdtId: string, since: number): Promise<CRDTOperationPayload[]> {
    const operations = await this.db
      .select()
      .from(crdtOperations)
      .where(and(eq(crdtOperations.crdtId, crdtId), gte(crdtOperations.timestamp, since)))
      .orderBy(crdtOperations.timestamp);

    return operations.map((op) => ({
      crdtId: op.crdtId,
      crdtType: op.crdtType as CRDTType,
      operationType: op.operationType as CRDTOperationType,
      payload: op.payload as Record<string, unknown>,
      nodeId: op.nodeId,
      timestamp: op.timestamp,
    }));
  }

  /**
   * Saves composite CRDT state (multiple CRDTs in one record).
   * Useful for WorkingMemory which uses multiple CRDTs.
   *
   * Supports storing multiple CRDTs with keys like "lww_register:context" or "or_set:agents"
   *
   * @param crdtId - Unique identifier
   * @param states - Map of CRDT key (e.g., "lww_register:context") to serialized data
   */
  async saveCompositeState(
    crdtId: string,
    states: Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>,
  ): Promise<void> {
    const stateData: Record<string, unknown> = {};

    for (const [key, data] of states) {
      stateData[key] = data;
    }

    const existing = await findAgentContextById(this.db, crdtId);

    if (existing) {
      const currentContext = (existing.context as Record<string, unknown>) || {};
      await this.db
        .update(agentContexts)
        .set({
          context: {
            ...currentContext,
            _crdt: stateData,
          },
          updatedAt: new Date(),
        })
        .where(eq(agentContexts.id, crdtId));
    } else {
      await this.db.insert(agentContexts).values({
        id: crdtId,
        version: 1,
        sessionId: crdtId.split(':')[0] || '',
        agentId: crdtId.split(':')[1] || '',
        context: {
          _crdt: stateData,
        },
        priority: 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Loads composite CRDT state (multiple CRDTs from one record).
   *
   * @param crdtId - Unique identifier
   * @returns Map of CRDT key (e.g., "lww_register:context") to serialized data
   */
  async loadCompositeState(
    crdtId: string,
  ): Promise<Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>> {
    const context = await findAgentContextById(this.db, crdtId);

    const result = new Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>();

    if (!context?.context) {
      return result;
    }

    const contextData = context.context as Record<string, unknown>;
    const crdtData = contextData._crdt as Record<string, unknown> | undefined;

    if (!crdtData) {
      return result;
    }

    // Return all CRDT states with their keys
    for (const [key, data] of Object.entries(crdtData)) {
      if (data && typeof data === 'object') {
        result.set(key, data as LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData);
      }
    }

    return result;
  }

  /**
   * Rebuilds CRDT state by replaying operations from the log.
   *
   * @param crdtId - CRDT instance identifier
   * @param crdtType - Type of CRDT to rebuild
   * @param nodeId - Node ID for the rebuilt CRDT
   * @param since - Optional timestamp to replay from (defaults to 0 = all)
   * @returns Rebuilt CRDT instance, or null if no operations found
   */
  async replayOperations(
    crdtId: string,
    crdtType: CRDTType,
    nodeId: string,
    since: number = 0,
  ): Promise<LWWRegister<unknown> | ORSet<unknown> | PNCounter | null> {
    const operations = await this.getOperationsSince(crdtId, since);

    if (operations.length === 0) {
      return null;
    }

    if (crdtType === 'lww_register') {
      const register = new LWWRegister<unknown>(nodeId, null, 0);
      for (const op of operations) {
        if (op.operationType === 'set') {
          register.set(op.payload.value, op.timestamp);
        }
      }
      return register;
    }

    if (crdtType === 'or_set') {
      const set = new ORSet<unknown>(nodeId);
      for (const op of operations) {
        if (op.operationType === 'add') {
          set.add(op.payload.value);
        } else if (op.operationType === 'remove' && typeof op.payload.tag === 'string') {
          set.remove(op.payload.tag);
        }
      }
      return set;
    }

    if (crdtType === 'pn_counter') {
      const counter = new PNCounter(nodeId);
      for (const op of operations) {
        if (op.operationType === 'increment') {
          counter.increment(typeof op.payload.delta === 'number' ? op.payload.delta : 1);
        } else if (op.operationType === 'decrement') {
          counter.decrement(typeof op.payload.delta === 'number' ? op.payload.delta : 1);
        }
      }
      return counter;
    }

    return null;
  }

  /**
   * Deletes operations older than a timestamp (for cleanup after compaction).
   *
   * @param crdtId - CRDT instance identifier
   * @param before - Unix timestamp (milliseconds) — delete operations older than this
   * @returns Number of operations deleted
   */
  async deleteOperationsBefore(crdtId: string, before: number): Promise<number> {
    const { lt } = await import('drizzle-orm');
    const result = await this.db
      .delete(crdtOperations)
      .where(and(eq(crdtOperations.crdtId, crdtId), lt(crdtOperations.timestamp, before)))
      .returning();
    return result.length;
  }
}
