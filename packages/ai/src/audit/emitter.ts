/**
 * Audit Emitter
 *
 * Write-only interface for agents. Agents can emit events but cannot
 * read, query, modify, or delete audit entries. This enforces the
 * separation between agent execution and human oversight.
 *
 * The emitter is created by the AuditObserver and injected into agents
 * via the runtime. Agents never have access to the observer itself.
 */

import type { AuditEventType, AuditSeverity } from './types.js';

// ─── Emitter Interface ──────────────────────────────────────────────────────

/**
 * Write-only audit interface provided to agents.
 * This is the ONLY audit API agents can access.
 */
export interface AuditEmitter {
  /**
   * Emit an audit event. This is a fire-and-forget operation  -
   * the agent does not receive confirmation or any data back.
   */
  emit(eventType: AuditEventType, payload: Record<string, unknown>, severity?: AuditSeverity): void;
}

// ─── Emit Handler ───────────────────────────────────────────────────────────

/** Internal handler signature used by the observer to receive emitted events */
export type AuditEmitHandler = (
  agentId: string,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
  severity: AuditSeverity,
) => void;

// ─── Emitter Factory ────────────────────────────────────────────────────────

/**
 * Creates a frozen, write-only AuditEmitter bound to a specific agent.
 * The returned object is frozen to prevent agents from modifying it.
 *
 * @param agentId - The agent this emitter is scoped to
 * @param handler - Internal handler that routes events to the observer
 * @returns A frozen, write-only AuditEmitter
 */
export function createAuditEmitter(agentId: string, handler: AuditEmitHandler): AuditEmitter {
  const emitter: AuditEmitter = {
    emit(
      eventType: AuditEventType,
      payload: Record<string, unknown>,
      severity: AuditSeverity = 'info',
    ): void {
      // Fire-and-forget  -  agents don't get feedback from the audit system
      try {
        handler(agentId, eventType, payload, severity);
      } catch {
        // Silently swallow errors  -  audit failures must never affect agent execution
      }
    },
  };

  // Freeze to prevent agents from replacing or extending the emitter
  return Object.freeze(emitter);
}
