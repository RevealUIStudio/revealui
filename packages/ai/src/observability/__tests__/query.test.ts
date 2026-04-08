import { beforeEach, describe, expect, it } from 'vitest';
import { AgentEventLogger } from '../logger.js';
import { AgentEventQuery } from '../query.js';

describe('AgentEventQuery', () => {
  let logger: AgentEventLogger;
  let query: AgentEventQuery;

  beforeEach(() => {
    logger = new AgentEventLogger();
    query = new AgentEventQuery(logger);

    // Add test events
    logger.logDecision({
      timestamp: Date.now() - 3600000, // 1 hour ago
      agentId: 'agent-1',
      sessionId: 'session-1',
      reasoning: 'Test decision 1',
    });

    logger.logToolCall({
      timestamp: Date.now() - 1800000, // 30 min ago
      agentId: 'agent-1',
      sessionId: 'session-1',
      toolName: 'search',
      params: {},
      durationMs: 100,
      success: true,
    });

    logger.logLLMCall({
      timestamp: Date.now() - 900000, // 15 min ago
      agentId: 'agent-2',
      sessionId: 'session-2',
      provider: 'openai',
      model: 'gpt-4',
      promptTokens: 100,
      completionTokens: 50,
      durationMs: 200,
      cost: 0.01,
    });

    logger.logError({
      timestamp: Date.now(),
      agentId: 'agent-1',
      sessionId: 'session-1',
      message: 'Test error',
      recoverable: true,
    });
  });

  describe('Time-based queries', () => {
    it('should get events in range', () => {
      const start = new Date(Date.now() - 2000000);
      const end = new Date();

      const events = query.getEventsInRange(start, end);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should get recent events', () => {
      const events = query.getRecentEvents(2000000); // Last ~33 minutes
      expect(events.length).toBeGreaterThan(0);
    });

    it('should get events from last N minutes', () => {
      const events = query.getEventsLastMinutes(60);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should get events from today', () => {
      const events = query.getEventsToday();
      // At least the "now" event is always today; others may cross midnight boundary
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Entity-based queries', () => {
    it('should get events for specific agent', () => {
      const events = query.getEventsForAgent('agent-1');
      expect(events.length).toBe(3);
      expect(events.every((e) => e.agentId === 'agent-1')).toBe(true);
    });

    it('should get events for specific session', () => {
      const events = query.getEventsForSession('session-1');
      expect(events.length).toBe(3);
      expect(events.every((e) => e.sessionId === 'session-1')).toBe(true);
    });

    it('should get events for multiple agents', () => {
      const events = query.getEventsForAgents(['agent-1', 'agent-2']);
      expect(events.length).toBe(4);
    });
  });

  describe('Type-based queries', () => {
    it('should get decisions', () => {
      const decisions = query.getDecisions();
      expect(decisions.length).toBe(1);
      expect(decisions[0].eventType).toBe('decision');
    });

    it('should get tool calls', () => {
      const toolCalls = query.getToolCalls();
      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].eventType).toBe('tool_call');
    });

    it('should get LLM calls', () => {
      const llmCalls = query.getLLMCalls();
      expect(llmCalls.length).toBe(1);
      expect(llmCalls[0].eventType).toBe('llm_call');
    });

    it('should get errors', () => {
      const errors = query.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].eventType).toBe('error');
    });
  });

  describe('Advanced queries', () => {
    it('should get successful tool calls', () => {
      const successful = query.getSuccessfulToolCalls();
      expect(successful.length).toBe(1);
      expect(successful[0].success).toBe(true);
    });

    it('should get tool calls for specific tool', () => {
      const searchCalls = query.getToolCallsForTool('search');
      expect(searchCalls.length).toBe(1);
      expect(searchCalls[0].toolName).toBe('search');
    });

    it('should get LLM calls for specific provider', () => {
      const openaiCalls = query.getLLMCallsForProvider('openai');
      expect(openaiCalls.length).toBe(1);
      expect(openaiCalls[0].provider).toBe('openai');
    });

    it('should get LLM calls for specific model', () => {
      const gpt4Calls = query.getLLMCallsForModel('gpt-4');
      expect(gpt4Calls.length).toBe(1);
      expect(gpt4Calls[0].model).toBe('gpt-4');
    });

    it('should get recoverable errors', () => {
      const recoverable = query.getRecoverableErrors();
      expect(recoverable.length).toBe(1);
      expect(recoverable[0].recoverable).toBe(true);
    });
  });

  describe('Aggregations', () => {
    it('should count events by type', () => {
      const counts = query.getEventCountByType();
      expect(counts.decision).toBe(1);
      expect(counts.tool_call).toBe(1);
      expect(counts.llm_call).toBe(1);
      expect(counts.error).toBe(1);
    });

    it('should get unique agent IDs', () => {
      const agentIds = query.getUniqueAgentIds();
      expect(agentIds).toHaveLength(2);
      expect(agentIds).toContain('agent-1');
      expect(agentIds).toContain('agent-2');
    });

    it('should get unique session IDs', () => {
      const sessionIds = query.getUniqueSessionIds();
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
    });

    it('should calculate total token usage', () => {
      const usage = query.getTotalTokenUsage();
      expect(usage.promptTokens).toBe(100);
      expect(usage.completionTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
    });

    it('should calculate total LLM cost', () => {
      const cost = query.getTotalLLMCost();
      expect(cost).toBe(0.01);
    });

    it('should calculate average tool call duration', () => {
      const avg = query.getAverageToolCallDuration();
      expect(avg).toBe(100);
    });

    it('should calculate success rate', () => {
      const rate = query.getSuccessRate();
      expect(rate).toBe(100);
    });

    it('should get metrics summary', () => {
      const summary = query.getMetricsSummary();
      expect(summary.totalEvents).toBe(4);
      expect(summary.activeAgents).toBe(2);
      expect(summary.activeSessions).toBe(2);
      expect(summary.totalTokensUsed).toBe(150);
      expect(summary.totalCost).toBe(0.01);
      expect(summary.averageSuccessRate).toBe(100);
    });
  });

  describe('Search and filter', () => {
    it('should search events by text', () => {
      const results = query.searchEvents('decision');
      expect(results.length).toBe(1);
      expect(results[0].eventType).toBe('decision');
    });

    it('should sort events ascending', () => {
      const events = query.getSortedEvents(undefined, 'asc');
      expect(events[0].timestamp).toBeLessThan(events[events.length - 1].timestamp);
    });

    it('should sort events descending', () => {
      const events = query.getSortedEvents(undefined, 'desc');
      expect(events[0].timestamp).toBeGreaterThan(events[events.length - 1].timestamp);
    });

    it('should paginate events', () => {
      const page1 = query.paginateEvents(1, 2);
      expect(page1.events.length).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(2);
      expect(page1.totalEvents).toBe(4);

      const page2 = query.paginateEvents(2, 2);
      expect(page2.events.length).toBe(2);
      expect(page2.page).toBe(2);
    });
  });
});
