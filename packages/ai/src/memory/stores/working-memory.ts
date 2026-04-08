/**
 * Working Memory
 *
 * Short-term, session-scoped memory for AI agents.
 * Uses CRDTs for conflict-free state management across distributed nodes.
 *
 * - Context: LWWRegister for single-valued state (last writer wins)
 * - Active Agents: ORSet for collection of active agent configurations
 * - Session State: LWWRegister for session metadata
 */

import type { AgentDefinition } from '@revealui/contracts/agents';
import { LWWRegister, type LWWRegisterData } from '../crdt/lww-register.js';
import { ORSet, type ORSetData } from '../crdt/or-set.js';
import type { PNCounterData } from '../crdt/pn-counter.js';
import type { CRDTPersistence } from '../persistence/crdt-persistence.js';
import { deepClone } from '../utils/deep-clone.js';

// =============================================================================
// Types
// =============================================================================

export interface SessionState {
  status: 'active' | 'paused' | 'completed';
  focus?: {
    siteId?: string;
    pageId?: string;
    blockId?: string;
    selection?: string[];
  };
  currentTask?: {
    id: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
  };
}

export interface WorkingMemoryData {
  sessionId: string;
  nodeId: string;
  context: LWWRegisterData<Record<string, unknown>>;
  sessionState: LWWRegisterData<SessionState>;
  activeAgents: ORSetData<AgentDefinition>;
}

// =============================================================================
// Working Memory
// =============================================================================

/**
 * Working Memory for session-scoped agent state.
 *
 * @example
 * ```typescript
 * const memory = new WorkingMemory('session-123', 'node-abc')
 * await memory.load()
 *
 * memory.setContext({ userId: 'user-1', theme: 'dark' })
 * const agentTag = memory.addAgent(agentConfig)
 * memory.updateSessionState({ status: 'active' })
 *
 * await memory.save()
 * ```
 */
export class WorkingMemory {
  private context: LWWRegister<Record<string, unknown>>;
  private sessionState: LWWRegister<SessionState>;
  private activeAgents: ORSet<AgentDefinition>;
  private sessionId: string;
  private nodeId: string;
  private persistence?: CRDTPersistence;

  /**
   * Creates a new WorkingMemory instance.
   *
   * @param sessionId - Unique session identifier
   * @param nodeId - Unique node identifier (for CRDT operations)
   * @param persistence - Optional persistence adapter
   */
  constructor(sessionId: string, nodeId: string, persistence?: CRDTPersistence) {
    this.sessionId = sessionId;
    this.nodeId = nodeId;
    this.persistence = persistence;

    // Initialize CRDTs
    this.context = new LWWRegister<Record<string, unknown>>(nodeId, {});
    this.sessionState = new LWWRegister<SessionState>(nodeId, {
      status: 'active',
    });
    this.activeAgents = new ORSet<AgentDefinition>(nodeId);
  }

  /**
   * Sets the entire context object.
   *
   * @param context - Context data to set
   */
  /**
   * Sets the entire context object.
   *
   * **Performance Note**: This replaces the entire context. For partial updates,
   * use `updateContext()` or `setContextValue()`.
   *
   * **Validation**: The context is validated by LWWRegister (which clones values),
   * but for additional security, consider validating before calling this method.
   *
   * @param context - The complete context object
   */
  setContext(context: Record<string, unknown>): void {
    this.context.set(context);
  }

  /**
   * Gets the current context.
   *
   * @returns Current context object
   */
  getContext(): Record<string, unknown> {
    return this.context.get();
  }

  /**
   * Updates context with partial data.
   * Merges with existing context.
   *
   * @param updates - Partial context updates
   */
  updateContext(updates: Partial<Record<string, unknown>>): void {
    const current = this.context.get();
    this.context.set({
      ...current,
      ...updates,
    });
  }

  /**
   * Gets a specific context value.
   *
   * @param key - Context key
   * @returns Context value or undefined
   */
  /**
   * Gets a specific context value by key.
   *
   * **Immutability Guarantee**: Returns a deep clone of object/array values to prevent external mutations.
   * Primitives (strings, numbers, booleans, null) are returned as-is.
   *
   * @param key - The context key to retrieve
   * @returns The context value (cloned if object/array, direct reference if primitive)
   */
  getContextValue(key: string): unknown {
    const context = this.context.get(); // Already cloned by LWWRegister.get()
    const value = context[key];
    // Explicitly clone the value for clarity and to ensure immutability
    // Note: This may result in double cloning (context is already cloned),
    // but it makes the API contract explicit and safe
    if (value !== null && typeof value === 'object') {
      return deepClone(value);
    }
    return value;
  }

  /**
   * Sets a specific context value.
   *
   * **Performance Note**: This method clones the entire context object to update
   * a single key. For multiple updates, use `updateContext()` instead.
   *
   * @param key - Context key
   * @param value - Context value
   */
  setContextValue(key: string, value: unknown): void {
    const current = this.context.get();
    this.context.set({
      ...current,
      [key]: value,
    });
  }

  /**
   * Adds an agent to the active agents set.
   *
   * @param agent - Agent configuration
   * @returns Unique tag for this agent addition
   */
  addAgent(agent: AgentDefinition): string {
    return this.activeAgents.add(agent);
  }

  /**
   * Removes an agent by tag.
   *
   * @param tag - Tag returned from addAgent
   * @returns true if agent was removed
   */
  removeAgent(tag: string): boolean {
    return this.activeAgents.remove(tag);
  }

  /**
   * Removes an agent by ID (removes all instances).
   *
   * @param agentId - Agent ID to remove
   * @returns Number of instances removed
   */
  removeAgentById(agentId: string): number {
    const agents = this.activeAgents.values();
    let count = 0;

    for (const agent of agents) {
      if (agent.id === agentId) {
        const entries = this.activeAgents.entries();
        for (const [tag, agentValue] of entries) {
          if (agentValue.id === agentId) {
            this.activeAgents.remove(tag);
            count++;
          }
        }
        break;
      }
    }

    return count;
  }

  /**
   * Gets all active agents.
   *
   * @returns Array of active agent configurations
   */
  getActiveAgents(): AgentDefinition[] {
    return this.activeAgents.values();
  }

  /**
   * Checks if an agent is active.
   *
   * @param agentId - Agent ID to check
   * @returns true if agent is active
   */
  hasAgent(agentId: string): boolean {
    return this.activeAgents.values().some((agent) => agent.id === agentId);
  }

  /**
   * Updates session state with partial data.
   *
   * @param state - Partial session state
   */
  updateSessionState(state: Partial<SessionState>): void {
    const current = this.sessionState.get();
    this.sessionState.set({
      ...current,
      ...state,
    });
  }

  /**
   * Gets the current session state.
   *
   * @returns Current session state
   */
  getSessionState(): SessionState {
    return this.sessionState.get();
  }

  /**
   * Merges another WorkingMemory into this one.
   * Uses CRDT merge operations for conflict resolution.
   *
   * @param other - WorkingMemory to merge
   * @returns New merged WorkingMemory
   */
  merge(other: WorkingMemory): WorkingMemory {
    const merged = new WorkingMemory(this.sessionId, this.nodeId, this.persistence);

    // Merge CRDTs
    merged.context = this.context.merge(other.context);
    merged.sessionState = this.sessionState.merge(other.sessionState);
    merged.activeAgents = this.activeAgents.merge(other.activeAgents);

    return merged;
  }

  /**
   * Loads state from database.
   *
   * @throws Error if persistence is not configured
   */
  async load(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.');
    }

    const crdtId = `working-memory:${this.sessionId}`;
    const states = await this.persistence.loadCompositeState(crdtId);

    // Restore context
    const contextData = states.get('lww_register:context');
    if (contextData && 'value' in contextData) {
      const contextReg = LWWRegister.fromData(
        contextData as LWWRegisterData<Record<string, unknown>>,
      );
      this.context = contextReg;
    }

    // Restore session state
    const sessionStateData = states.get('lww_register:sessionState');
    if (sessionStateData && 'value' in sessionStateData) {
      const sessionStateReg = LWWRegister.fromData(
        sessionStateData as LWWRegisterData<SessionState>,
      );
      this.sessionState = sessionStateReg;
    }

    // Restore active agents
    const agentsData = states.get('or_set:activeAgents');
    if (agentsData && 'added' in agentsData) {
      const agentsSet = ORSet.fromData<AgentDefinition>(agentsData as ORSetData<AgentDefinition>);
      this.activeAgents = agentsSet;
    }
  }

  /**
   * Saves state to database.
   *
   * @throws Error if persistence is not configured
   */
  async save(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.');
    }

    const crdtId = `working-memory:${this.sessionId}`;
    const states = new Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>();

    // Save all CRDTs with composite keys
    states.set('lww_register:context', this.context.toData());
    states.set('lww_register:sessionState', this.sessionState.toData());
    states.set('or_set:activeAgents', this.activeAgents.toData());

    await this.persistence.saveCompositeState(crdtId, states);
  }

  /**
   * Serializes WorkingMemory to plain object.
   *
   * @returns Serialized data
   */
  toData(): WorkingMemoryData {
    return {
      sessionId: this.sessionId,
      nodeId: this.nodeId,
      context: this.context.toData(),
      sessionState: this.sessionState.toData(),
      activeAgents: this.activeAgents.toData(),
    };
  }

  /**
   * Deserializes WorkingMemory from plain object.
   *
   * @param data - Serialized data
   * @param persistence - Optional persistence adapter
   * @returns New WorkingMemory instance
   */
  static fromData(data: WorkingMemoryData, persistence?: CRDTPersistence): WorkingMemory {
    const memory = new WorkingMemory(data.sessionId, data.nodeId, persistence);
    memory.context = LWWRegister.fromData(data.context);
    memory.sessionState = LWWRegister.fromData(data.sessionState);
    memory.activeAgents = ORSet.fromData<AgentDefinition>(data.activeAgents);
    return memory;
  }

  /**
   * Creates a copy of this WorkingMemory.
   *
   * @returns New WorkingMemory with same state
   */
  clone(): WorkingMemory {
    return WorkingMemory.fromData(this.toData(), this.persistence);
  }

  /**
   * Gets the session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Gets the node ID.
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Gets the context register's timestamp.
   * Used for proper CRDT merge semantics.
   *
   * @returns Timestamp of the last context update
   */
  getContextTimestamp(): number {
    return this.context.getTimestamp();
  }
}
