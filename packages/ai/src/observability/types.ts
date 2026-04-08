/**
 * @revealui/ai - Observability Types
 *
 * Event types for tracking agent operations, decisions, tool calls, and LLM usage.
 */

/**
 * Base event type for all agent operations
 */
export interface AgentEvent {
  timestamp: number;
  eventType: 'decision' | 'tool_call' | 'llm_call' | 'error';
  agentId: string;
  sessionId: string;
  taskId?: string;
}

/**
 * Decision event - tracks agent reasoning and tool selection
 */
export interface DecisionEvent extends AgentEvent {
  eventType: 'decision';
  reasoning: string;
  chosenTool?: string;
  confidence?: number;
  context?: Record<string, unknown>;
}

/**
 * Tool call event - tracks tool invocations
 */
export interface ToolCallEvent extends AgentEvent {
  eventType: 'tool_call';
  toolName: string;
  params: Record<string, unknown>;
  result?: unknown;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * LLM call event - tracks language model usage
 */
export interface LLMCallEvent extends AgentEvent {
  eventType: 'llm_call';
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  cost?: number;
  cacheHit?: boolean;
}

/**
 * Error event - tracks failures and exceptions
 */
export interface ErrorEvent extends AgentEvent {
  eventType: 'error';
  message: string;
  stack?: string;
  recoverable: boolean;
  errorCode?: string;
  context?: Record<string, unknown>;
}

/**
 * Union type of all event types
 */
export type AnyAgentEvent = DecisionEvent | ToolCallEvent | LLMCallEvent | ErrorEvent;

/**
 * Event filter for querying events
 */
export interface EventFilter {
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  eventType?: AgentEvent['eventType'];
  startTime?: number;
  endTime?: number;
}

/**
 * Tool-specific metrics
 */
export interface ToolMetrics {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  lastUsed: number;
}

/**
 * LLM-specific metrics
 */
export interface LLMMetrics {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  averageDurationMs: number;
  cacheHitRate: number;
  modelUsage: Record<string, number>;
}

/**
 * Aggregated agent metrics
 */
export interface AgentMetrics {
  totalDecisions: number;
  totalToolCalls: number;
  totalLLMCalls: number;
  totalErrors: number;
  averageDecisionTime: number;
  successRate: number;
  errorRate: number;
  toolMetrics: Map<string, ToolMetrics>;
  llmMetrics: LLMMetrics;
  uptime: number;
  lastActivity: number;
}

/**
 * Metrics summary for display
 */
export interface MetricsSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  activeAgents: number;
  activeSessions: number;
  totalTokensUsed: number;
  totalCost: number;
  averageSuccessRate: number;
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Storage backend interface
 */
export interface EventStorage {
  save(events: AnyAgentEvent[]): Promise<void>;
  load(filter?: EventFilter): Promise<AnyAgentEvent[]>;
  clear(): Promise<void>;
  count(filter?: EventFilter): Promise<number>;
}
