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
import type { LWWRegisterData, ORSetData, PNCounterData } from '../crdt/index.js';
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
}
