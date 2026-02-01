/**
 * React Hooks for AI System
 *
 * Frontend integration hooks:
 * - useWorkingMemory: Working memory management
 * - useEpisodicMemory: Episodic memory management
 * - useAgentContext: Agent context management
 * - useAgentEvents: Real-time agent event monitoring
 * - useAgentMetrics: Agent metrics and statistics
 * - useEventQuery: Advanced event querying
 * - useEventStream: Real-time event streaming
 * - usePaginatedEvents: Paginated event display
 *
 * @packageDocumentation
 */

export {
  type UseAgentContextOptions,
  type UseAgentContextReturn,
  useAgentContext,
} from './useAgentContext.js'
export {
  useAgentEvents,
  useAgentMetrics,
  useEventQuery,
  useEventStream,
  useLLMUsageStats,
  useMetricsSummary,
  usePaginatedEvents,
  useToolUsageStats,
} from './useAgentEvents.js'
export {
  type UseEpisodicMemoryReturn,
  useEpisodicMemory,
} from './useEpisodicMemory.js'
export {
  type UseWorkingMemoryOptions,
  type UseWorkingMemoryReturn,
  useWorkingMemory,
} from './useWorkingMemory.js'
