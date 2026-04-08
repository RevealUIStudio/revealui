/**
 * @revealui/ai - Agent Event Logger
 *
 * Circular buffer event logger for tracking agent operations.
 * Maintains last N events in memory with optional persistence.
 */

import type {
  AnyAgentEvent,
  DecisionEvent,
  ErrorEvent,
  EventFilter,
  EventStorage,
  LLMCallEvent,
  ToolCallEvent,
} from './types.js';

/**
 * Agent event logger with circular buffer
 */
export class AgentEventLogger {
  private events: AnyAgentEvent[] = [];
  private maxEvents: number;
  private storage?: EventStorage;
  private autoFlush: boolean;
  private flushInterval?: NodeJS.Timeout;

  constructor(options?: {
    maxEvents?: number;
    storage?: EventStorage;
    autoFlush?: boolean;
    flushIntervalMs?: number;
  }) {
    this.maxEvents = options?.maxEvents ?? 1000;
    this.storage = options?.storage;
    this.autoFlush = options?.autoFlush ?? false;

    if (this.autoFlush && this.storage && options?.flushIntervalMs) {
      this.flushInterval = setInterval(() => {
        void this.flush();
      }, options.flushIntervalMs);
    }
  }

  /**
   * Log a decision event
   */
  logDecision(event: Omit<DecisionEvent, 'eventType'>): void {
    this.addEvent({
      ...event,
      eventType: 'decision',
    });
  }

  /**
   * Log a tool call event
   */
  logToolCall(event: Omit<ToolCallEvent, 'eventType'>): void {
    this.addEvent({
      ...event,
      eventType: 'tool_call',
    });
  }

  /**
   * Log an LLM call event
   */
  logLLMCall(event: Omit<LLMCallEvent, 'eventType'>): void {
    this.addEvent({
      ...event,
      eventType: 'llm_call',
    });
  }

  /**
   * Log an error event
   */
  logError(event: Omit<ErrorEvent, 'eventType'>): void {
    this.addEvent({
      ...event,
      eventType: 'error',
    });
  }

  /**
   * Add event to circular buffer
   */
  private addEvent(event: AnyAgentEvent): void {
    this.events.push(event);

    // Maintain circular buffer size
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Get events matching filter
   */
  getEvents(filter?: EventFilter): AnyAgentEvent[] {
    let filtered = [...this.events];

    if (!filter) {
      return filtered;
    }

    if (filter.agentId) {
      filtered = filtered.filter((e) => e.agentId === filter.agentId);
    }

    if (filter.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
    }

    if (filter.taskId) {
      filtered = filtered.filter((e) => e.taskId === filter.taskId);
    }

    if (filter.eventType) {
      filtered = filtered.filter((e) => e.eventType === filter.eventType);
    }

    if (filter.startTime) {
      const startTime = filter.startTime;
      filtered = filtered.filter((e) => e.timestamp >= startTime);
    }

    if (filter.endTime) {
      const endTime = filter.endTime;
      filtered = filtered.filter((e) => e.timestamp <= endTime);
    }

    return filtered;
  }

  /**
   * Get recent N events
   */
  getRecentEvents(count: number): AnyAgentEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get events by type
   */
  getDecisions(): DecisionEvent[] {
    return this.events.filter((e) => e.eventType === 'decision') as DecisionEvent[];
  }

  getToolCalls(): ToolCallEvent[] {
    return this.events.filter((e) => e.eventType === 'tool_call') as ToolCallEvent[];
  }

  getLLMCalls(): LLMCallEvent[] {
    return this.events.filter((e) => e.eventType === 'llm_call') as LLMCallEvent[];
  }

  getErrors(): ErrorEvent[] {
    return this.events.filter((e) => e.eventType === 'error') as ErrorEvent[];
  }

  /**
   * Get total event count
   */
  getCount(filter?: EventFilter): number {
    if (!filter) {
      return this.events.length;
    }
    return this.getEvents(filter).length;
  }

  /**
   * Clear all events from buffer
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Flush events to storage
   */
  async flush(): Promise<void> {
    if (!this.storage) {
      return;
    }

    await this.storage.save([...this.events]);
  }

  /**
   * Load events from storage
   */
  async load(filter?: EventFilter): Promise<void> {
    if (!this.storage) {
      return;
    }

    const events = await this.storage.load(filter);
    this.events = events.slice(-this.maxEvents);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
