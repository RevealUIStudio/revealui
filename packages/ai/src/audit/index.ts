/**
 * Audit Trail System
 *
 * Provides an immutable, append-only audit trail for all agent activity.
 * Designed with strict separation of concerns:
 *
 * - **Agents** receive a write-only `AuditEmitter` (can emit events, nothing else)
 * - **Humans** control the `AuditObserver` (query, policies, kill switches)
 * - **Store** is append-only (no updates, no deletes)
 *
 * This architecture ensures that AI agents cannot tamper with, disable,
 * or circumvent the audit trail  -  it lives entirely outside their scope.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { AuditObserver, InMemoryAuditStore, builtinPolicies } from '@revealui/ai'
 *
 * // Human sets up the observer (agents never see this)
 * const observer = new AuditObserver({
 *   store: new InMemoryAuditStore(),
 *   onAlert: (alert) => logger.warn('ALERT:', alert),
 *   onAgentHalted: (id, reason) => logger.warn(`Agent ${id} halted: ${reason}`),
 * })
 *
 * // Add safety policies
 * observer.addPolicy(builtinPolicies.toolCallRateLimit(100, 'admin'))
 * observer.addPolicy(builtinPolicies.selfModificationBlock('admin'))
 *
 * // Create write-only emitter for an agent
 * const emitter = observer.createEmitterForAgent('agent-1')
 * // Pass `emitter` to the agent  -  it can only call emitter.emit()
 *
 * // Human can halt agents at any time
 * observer.haltAgent('agent-1', 'admin', 'Suspicious behavior')
 * observer.haltFleet('admin', 'Emergency stop')
 * ```
 */

// Emitter (write-only agent interface)
export {
  type AuditEmitHandler,
  type AuditEmitter,
  createAuditEmitter,
} from './emitter.js';
// Observer (human-facing control plane)
export {
  AuditObserver,
  type AuditObserverConfig,
} from './observer.js';
// Policy engine
export {
  AuditPolicyEngine,
  builtinPolicies,
} from './policy.js';
// Store (append-only persistence)
export {
  type AuditStore,
  InMemoryAuditStore,
} from './store.js';
// Types
export {
  type AuditAgentStatus,
  type AuditAlert,
  type AuditEntry,
  AuditEntrySchema,
  AuditEventType,
  type AuditFilter,
  type AuditPolicy,
  AuditSeverity,
  PolicyAction,
} from './types.js';
