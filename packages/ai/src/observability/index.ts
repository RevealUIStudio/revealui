/**
 * @revealui/ai - Observability
 *
 * **INCUBATING (fleet-redundancy C11 / ADR-007).** Agent event/metrics helpers
 * are available as a library. No RevealUI app currently mounts this surface as
 * the product observability path; prefer explicit wiring under a WIRE ticket.
 *
 * Agent operation tracking, logging, and metrics collection.
 */

export {
  createDownloadableBlob,
  downloadEvents,
  EventExporter,
  exportToCSV,
  exportToFile,
  exportToJSON,
  exportToNDJSON,
} from './export.js';
export type { LLMCallOptions, LLMResponse } from './instrumentation.js';
export {
  instrumentAgent,
  instrumentLLMCall,
  instrumentTaskExecution,
  instrumentTool,
  LLMCostCalculators,
  logTaskDelegation,
} from './instrumentation.js';
export { AgentEventLogger } from './logger.js';
export { AgentMetricsCollector } from './metrics.js';
export { AgentEventQuery } from './query.js';
export {
  FileSystemEventStorage,
  LocalStorageEventStorage,
  MemoryEventStorage,
} from './storage.js';

// Type exports
export type {
  AgentEvent,
  AgentMetrics,
  DecisionEvent,
  ErrorEvent,
  EventFilter,
  EventStorage,
  LLMCallEvent,
  MetricsSummary,
  ToolCallEvent,
} from './types.js';
export * from './types.js';
