/**
 * @revealui/ai - Agent Metrics Collector
 *
 * Aggregates statistics from agent events for monitoring and analysis.
 */

import type { AgentEventLogger } from './logger.js';
import type {
  AgentMetrics,
  AnyAgentEvent,
  EventFilter,
  LLMMetrics,
  MetricsSummary,
  ToolMetrics,
} from './types.js';

/**
 * Agent metrics collector
 */
export class AgentMetricsCollector {
  private logger: AgentEventLogger;
  private startTime: number;

  constructor(logger: AgentEventLogger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  /**
   * Get metrics for a specific agent
   */
  getMetrics(agentId: string): AgentMetrics {
    const filter: EventFilter = { agentId };
    const events = this.logger.getEvents(filter);

    const decisions = events.filter((e) => e.eventType === 'decision');
    const toolCalls = events.filter((e) => e.eventType === 'tool_call');
    const llmCalls = events.filter((e) => e.eventType === 'llm_call');
    const errors = events.filter((e) => e.eventType === 'error');

    const totalDecisions = decisions.length;
    const totalToolCalls = toolCalls.length;
    const totalLLMCalls = llmCalls.length;
    const totalErrors = errors.length;

    // Calculate average decision time (time between decisions)
    let averageDecisionTime = 0;
    if (decisions.length > 1) {
      const times = decisions.map((d) => d.timestamp).sort((a, b) => a - b);
      const intervals: number[] = [];
      for (let i = 1; i < times.length; i++) {
        const current = times[i];
        const previous = times[i - 1];
        if (current !== undefined && previous !== undefined) {
          intervals.push(current - previous);
        }
      }
      averageDecisionTime = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    }

    // Calculate success rate
    const successfulCalls = toolCalls.filter(
      (t) => t.eventType === 'tool_call' && t.success,
    ).length;
    const successRate = totalToolCalls > 0 ? (successfulCalls / totalToolCalls) * 100 : 0;

    // Calculate error rate
    const totalOperations = totalDecisions + totalToolCalls + totalLLMCalls;
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    // Build tool metrics
    const toolMetrics = this.calculateToolMetrics(toolCalls);

    // Build LLM metrics
    const llmMetrics = this.calculateLLMMetrics(llmCalls);

    // Calculate uptime and last activity
    const uptime = Date.now() - this.startTime;
    const lastActivity =
      events.length > 0 ? Math.max(...events.map((e) => e.timestamp)) : this.startTime;

    return {
      totalDecisions,
      totalToolCalls,
      totalLLMCalls,
      totalErrors,
      averageDecisionTime,
      successRate,
      errorRate,
      toolMetrics,
      llmMetrics,
      uptime,
      lastActivity,
    };
  }

  /**
   * Calculate tool-specific metrics
   */
  private calculateToolMetrics(toolCalls: AnyAgentEvent[]): Map<string, ToolMetrics> {
    const metrics = new Map<string, ToolMetrics>();

    for (const event of toolCalls) {
      if (event.eventType !== 'tool_call') continue;

      const existing = metrics.get(event.toolName);
      const success = event.success ? 1 : 0;
      const failure = event.success ? 0 : 1;

      if (existing) {
        metrics.set(event.toolName, {
          totalCalls: existing.totalCalls + 1,
          successCount: existing.successCount + success,
          failureCount: existing.failureCount + failure,
          averageDurationMs:
            (existing.averageDurationMs * existing.totalCalls + event.durationMs) /
            (existing.totalCalls + 1),
          lastUsed: Math.max(existing.lastUsed, event.timestamp),
        });
      } else {
        metrics.set(event.toolName, {
          totalCalls: 1,
          successCount: success,
          failureCount: failure,
          averageDurationMs: event.durationMs,
          lastUsed: event.timestamp,
        });
      }
    }

    return metrics;
  }

  /**
   * Calculate LLM-specific metrics
   */
  private calculateLLMMetrics(llmCalls: AnyAgentEvent[]): LLMMetrics {
    let totalCalls = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    let totalDuration = 0;
    let cacheHits = 0;
    const modelUsage: Record<string, number> = {};

    for (const event of llmCalls) {
      if (event.eventType !== 'llm_call') continue;

      totalCalls++;
      totalPromptTokens += event.promptTokens;
      totalCompletionTokens += event.completionTokens;
      totalCost += event.cost ?? 0;
      totalDuration += event.durationMs;

      if (event.cacheHit) {
        cacheHits++;
      }

      const modelKey = `${event.provider}/${event.model}`;
      modelUsage[modelKey] = (modelUsage[modelKey] ?? 0) + 1;
    }

    return {
      totalCalls,
      totalPromptTokens,
      totalCompletionTokens,
      totalCost,
      averageDurationMs: totalCalls > 0 ? totalDuration / totalCalls : 0,
      cacheHitRate: totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0,
      modelUsage,
    };
  }

  /**
   * Get summary metrics across all agents
   */
  getMetricsSummary(filter?: EventFilter): MetricsSummary {
    const events = this.logger.getEvents(filter);

    const eventsByType: Record<string, number> = {};
    const agentIds = new Set<string>();
    const sessionIds = new Set<string>();

    let totalTokensUsed = 0;
    let totalCost = 0;
    let successfulToolCalls = 0;
    let totalToolCalls = 0;

    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] ?? 0) + 1;
      agentIds.add(event.agentId);
      sessionIds.add(event.sessionId);

      if (event.eventType === 'llm_call') {
        totalTokensUsed += event.promptTokens + event.completionTokens;
        totalCost += event.cost ?? 0;
      }

      if (event.eventType === 'tool_call') {
        totalToolCalls++;
        if (event.success) {
          successfulToolCalls++;
        }
      }
    }

    const timestamps = events.map((e) => e.timestamp);
    const start = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const end = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    return {
      totalEvents: events.length,
      eventsByType,
      activeAgents: agentIds.size,
      activeSessions: sessionIds.size,
      totalTokensUsed,
      totalCost,
      averageSuccessRate: totalToolCalls > 0 ? (successfulToolCalls / totalToolCalls) * 100 : 0,
      timeRange: { start, end },
    };
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): Array<{
    toolName: string;
    metrics: ToolMetrics;
  }> {
    const toolCalls = this.logger.getToolCalls();
    const metrics = this.calculateToolMetrics(toolCalls);

    return Array.from(metrics.entries())
      .map(([toolName, metrics]) => ({ toolName, metrics }))
      .sort((a, b) => b.metrics.totalCalls - a.metrics.totalCalls);
  }

  /**
   * Get LLM usage statistics
   */
  getLLMUsageStats(): LLMMetrics {
    const llmCalls = this.logger.getLLMCalls();
    return this.calculateLLMMetrics(llmCalls);
  }
}
