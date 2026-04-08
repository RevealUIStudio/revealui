/**
 * @revealui/ai - Query Interface
 *
 * Advanced querying capabilities for agent events.
 */

import type { AgentEventLogger } from './logger.js';
import type {
  AnyAgentEvent,
  DecisionEvent,
  ErrorEvent,
  EventFilter,
  LLMCallEvent,
  MetricsSummary,
  ToolCallEvent,
} from './types.js';

export class AgentEventQuery {
  private logger: AgentEventLogger;

  constructor(logger: AgentEventLogger) {
    this.logger = logger;
  }

  // =========================================================================
  // Time-based queries
  // =========================================================================

  /**
   * Get events in a specific time range
   */
  getEventsInRange(start: Date, end: Date): AnyAgentEvent[] {
    return this.logger.getEvents({
      startTime: start.getTime(),
      endTime: end.getTime(),
    });
  }

  /**
   * Get events from the last N milliseconds
   */
  getRecentEvents(milliseconds: number, count?: number): AnyAgentEvent[] {
    const events = this.logger.getEvents({
      startTime: Date.now() - milliseconds,
    });

    return count ? events.slice(-count) : events;
  }

  /**
   * Get events from the last N minutes
   */
  getEventsLastMinutes(minutes: number): AnyAgentEvent[] {
    return this.getRecentEvents(minutes * 60 * 1000);
  }

  /**
   * Get events from the last N hours
   */
  getEventsLastHours(hours: number): AnyAgentEvent[] {
    return this.getRecentEvents(hours * 60 * 60 * 1000);
  }

  /**
   * Get events from today
   */
  getEventsToday(): AnyAgentEvent[] {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return this.getEventsInRange(startOfDay, now);
  }

  // =========================================================================
  // Entity-based queries
  // =========================================================================

  /**
   * Get all events for a specific agent
   */
  getEventsForAgent(agentId: string): AnyAgentEvent[] {
    return this.logger.getEvents({ agentId });
  }

  /**
   * Get all events for a specific session
   */
  getEventsForSession(sessionId: string): AnyAgentEvent[] {
    return this.logger.getEvents({ sessionId });
  }

  /**
   * Get all events for a specific task
   */
  getEventsForTask(taskId: string): AnyAgentEvent[] {
    return this.logger.getEvents({ taskId });
  }

  /**
   * Get all events for multiple agents
   */
  getEventsForAgents(agentIds: string[]): AnyAgentEvent[] {
    const events: AnyAgentEvent[] = [];
    for (const agentId of agentIds) {
      events.push(...this.getEventsForAgent(agentId));
    }
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  // =========================================================================
  // Type-based queries
  // =========================================================================

  /**
   * Get all decision events
   */
  getDecisions(filter?: Omit<EventFilter, 'eventType'>): DecisionEvent[] {
    return this.logger.getEvents({
      ...filter,
      eventType: 'decision',
    }) as DecisionEvent[];
  }

  /**
   * Get all tool call events
   */
  getToolCalls(filter?: Omit<EventFilter, 'eventType'>): ToolCallEvent[] {
    return this.logger.getEvents({
      ...filter,
      eventType: 'tool_call',
    }) as ToolCallEvent[];
  }

  /**
   * Get all LLM call events
   */
  getLLMCalls(filter?: Omit<EventFilter, 'eventType'>): LLMCallEvent[] {
    return this.logger.getEvents({
      ...filter,
      eventType: 'llm_call',
    }) as LLMCallEvent[];
  }

  /**
   * Get all error events
   */
  getErrors(filter?: Omit<EventFilter, 'eventType'>): ErrorEvent[] {
    return this.logger.getEvents({
      ...filter,
      eventType: 'error',
    }) as ErrorEvent[];
  }

  // =========================================================================
  // Advanced queries
  // =========================================================================

  /**
   * Get successful tool calls
   */
  getSuccessfulToolCalls(filter?: Omit<EventFilter, 'eventType'>): ToolCallEvent[] {
    const toolCalls = this.getToolCalls(filter);
    return toolCalls.filter((call) => call.success);
  }

  /**
   * Get failed tool calls
   */
  getFailedToolCalls(filter?: Omit<EventFilter, 'eventType'>): ToolCallEvent[] {
    const toolCalls = this.getToolCalls(filter);
    return toolCalls.filter((call) => !call.success);
  }

  /**
   * Get tool calls for a specific tool
   */
  getToolCallsForTool(toolName: string, filter?: Omit<EventFilter, 'eventType'>): ToolCallEvent[] {
    const toolCalls = this.getToolCalls(filter);
    return toolCalls.filter((call) => call.toolName === toolName);
  }

  /**
   * Get LLM calls for a specific provider
   */
  getLLMCallsForProvider(
    provider: string,
    filter?: Omit<EventFilter, 'eventType'>,
  ): LLMCallEvent[] {
    const llmCalls = this.getLLMCalls(filter);
    return llmCalls.filter((call) => call.provider === provider);
  }

  /**
   * Get LLM calls for a specific model
   */
  getLLMCallsForModel(model: string, filter?: Omit<EventFilter, 'eventType'>): LLMCallEvent[] {
    const llmCalls = this.getLLMCalls(filter);
    return llmCalls.filter((call) => call.model === model);
  }

  /**
   * Get recoverable errors
   */
  getRecoverableErrors(filter?: Omit<EventFilter, 'eventType'>): ErrorEvent[] {
    const errors = this.getErrors(filter);
    return errors.filter((error) => error.recoverable);
  }

  /**
   * Get non-recoverable errors
   */
  getNonRecoverableErrors(filter?: Omit<EventFilter, 'eventType'>): ErrorEvent[] {
    const errors = this.getErrors(filter);
    return errors.filter((error) => !error.recoverable);
  }

  // =========================================================================
  // Aggregations
  // =========================================================================

  /**
   * Get event count by type
   */
  getEventCountByType(filter?: EventFilter): Record<string, number> {
    const events = this.logger.getEvents(filter);
    const counts: Record<string, number> = {};

    for (const event of events) {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get unique agent IDs
   */
  getUniqueAgentIds(filter?: EventFilter): string[] {
    const events = this.logger.getEvents(filter);
    const agentIds = new Set<string>();

    for (const event of events) {
      agentIds.add(event.agentId);
    }

    return Array.from(agentIds);
  }

  /**
   * Get unique session IDs
   */
  getUniqueSessionIds(filter?: EventFilter): string[] {
    const events = this.logger.getEvents(filter);
    const sessionIds = new Set<string>();

    for (const event of events) {
      sessionIds.add(event.sessionId);
    }

    return Array.from(sessionIds);
  }

  /**
   * Get total token usage
   */
  getTotalTokenUsage(filter?: Omit<EventFilter, 'eventType'>): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    const llmCalls = this.getLLMCalls(filter);

    let promptTokens = 0;
    let completionTokens = 0;

    for (const call of llmCalls) {
      promptTokens += call.promptTokens;
      completionTokens += call.completionTokens;
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /**
   * Get total LLM cost
   */
  getTotalLLMCost(filter?: Omit<EventFilter, 'eventType'>): number {
    const llmCalls = this.getLLMCalls(filter);
    return llmCalls.reduce((total, call) => total + (call.cost || 0), 0);
  }

  /**
   * Get average tool call duration
   */
  getAverageToolCallDuration(filter?: Omit<EventFilter, 'eventType'>): number {
    const toolCalls = this.getToolCalls(filter);

    if (toolCalls.length === 0) {
      return 0;
    }

    const totalDuration = toolCalls.reduce((sum, call) => sum + call.durationMs, 0);
    return totalDuration / toolCalls.length;
  }

  /**
   * Get average LLM call duration
   */
  getAverageLLMCallDuration(filter?: Omit<EventFilter, 'eventType'>): number {
    const llmCalls = this.getLLMCalls(filter);

    if (llmCalls.length === 0) {
      return 0;
    }

    const totalDuration = llmCalls.reduce((sum, call) => sum + call.durationMs, 0);
    return totalDuration / llmCalls.length;
  }

  /**
   * Get success rate
   */
  getSuccessRate(filter?: Omit<EventFilter, 'eventType'>): number {
    const toolCalls = this.getToolCalls(filter);

    if (toolCalls.length === 0) {
      return 0;
    }

    const successful = toolCalls.filter((call) => call.success).length;
    return (successful / toolCalls.length) * 100;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(filter?: EventFilter): MetricsSummary {
    const events = this.logger.getEvents(filter);
    const eventsByType = this.getEventCountByType(filter);
    const agentIds = this.getUniqueAgentIds(filter);
    const sessionIds = this.getUniqueSessionIds(filter);
    const tokenUsage = this.getTotalTokenUsage(filter);
    const totalCost = this.getTotalLLMCost(filter);
    const successRate = this.getSuccessRate(filter);

    const timestamps = events.map((e) => e.timestamp);
    const start = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const end = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    return {
      totalEvents: events.length,
      eventsByType,
      activeAgents: agentIds.length,
      activeSessions: sessionIds.length,
      totalTokensUsed: tokenUsage.totalTokens,
      totalCost,
      averageSuccessRate: successRate,
      timeRange: { start, end },
    };
  }

  // =========================================================================
  // Search and filter
  // =========================================================================

  /**
   * Search events by text in reasoning or error messages
   */
  searchEvents(searchText: string, filter?: EventFilter): AnyAgentEvent[] {
    const events = this.logger.getEvents(filter);
    const lowerSearch = searchText.toLowerCase();

    return events.filter((event) => {
      if (event.eventType === 'decision') {
        return event.reasoning.toLowerCase().includes(lowerSearch);
      }
      if (event.eventType === 'error') {
        return event.message.toLowerCase().includes(lowerSearch);
      }
      if (event.eventType === 'tool_call') {
        return event.toolName.toLowerCase().includes(lowerSearch);
      }
      return false;
    });
  }

  /**
   * Get events sorted by timestamp (ascending or descending)
   */
  getSortedEvents(filter?: EventFilter, order: 'asc' | 'desc' = 'asc'): AnyAgentEvent[] {
    const events = this.logger.getEvents(filter);
    return events.sort((a, b) =>
      order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
    );
  }

  /**
   * Paginate events
   */
  paginateEvents(
    page: number,
    pageSize: number,
    filter?: EventFilter,
  ): {
    events: AnyAgentEvent[];
    page: number;
    pageSize: number;
    totalPages: number;
    totalEvents: number;
  } {
    const allEvents = this.getSortedEvents(filter, 'desc');
    const totalEvents = allEvents.length;
    const totalPages = Math.ceil(totalEvents / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const events = allEvents.slice(start, end);

    return {
      events,
      page,
      pageSize,
      totalPages,
      totalEvents,
    };
  }
}
