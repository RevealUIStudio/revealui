import { beforeEach, describe, expect, it } from 'vitest';
import { AgentEventLogger } from '../logger.js';
import { AgentMetricsCollector } from '../metrics.js';

describe('AgentMetricsCollector', () => {
  let logger: AgentEventLogger;
  let collector: AgentMetricsCollector;

  beforeEach(() => {
    logger = new AgentEventLogger();
    collector = new AgentMetricsCollector(logger);
  });

  describe('Agent Metrics', () => {
    it('should calculate basic metrics', () => {
      logger.logDecision({
        timestamp: 1000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test decision',
      });

      logger.logToolCall({
        timestamp: 2000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logLLMCall({
        timestamp: 3000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });

      logger.logError({
        timestamp: 4000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        message: 'Test error',
        recoverable: true,
      });

      const metrics = collector.getMetrics('agent-1');

      expect(metrics.totalDecisions).toBe(1);
      expect(metrics.totalToolCalls).toBe(1);
      expect(metrics.totalLLMCalls).toBe(1);
      expect(metrics.totalErrors).toBe(1);
    });

    it('should calculate success rate', () => {
      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'fetch',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'parse',
        params: {},
        durationMs: 100,
        success: false,
      });

      const metrics = collector.getMetrics('agent-1');

      expect(metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate error rate', () => {
      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'test',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logError({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        message: 'Error',
        recoverable: true,
      });

      const metrics = collector.getMetrics('agent-1');

      expect(metrics.errorRate).toBeCloseTo(50, 1); // 1 error out of 2 operations
    });

    it('should calculate average decision time', () => {
      logger.logDecision({
        timestamp: 1000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Decision 1',
      });

      logger.logDecision({
        timestamp: 2000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Decision 2',
      });

      logger.logDecision({
        timestamp: 3500,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Decision 3',
      });

      const metrics = collector.getMetrics('agent-1');

      // Average between intervals: (1000ms + 1500ms) / 2 = 1250ms
      expect(metrics.averageDecisionTime).toBe(1250);
    });
  });

  describe('Tool Metrics', () => {
    it('should calculate tool-specific metrics', () => {
      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 200,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 150,
        success: false,
      });

      const metrics = collector.getMetrics('agent-1');
      const searchMetrics = metrics.toolMetrics.get('search');

      expect(searchMetrics).toBeDefined();
      expect(searchMetrics?.totalCalls).toBe(3);
      expect(searchMetrics?.successCount).toBe(2);
      expect(searchMetrics?.failureCount).toBe(1);
      expect(searchMetrics?.averageDurationMs).toBe(150);
    });

    it('should track multiple tools', () => {
      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'fetch',
        params: {},
        durationMs: 200,
        success: true,
      });

      const metrics = collector.getMetrics('agent-1');

      expect(metrics.toolMetrics.size).toBe(2);
      expect(metrics.toolMetrics.has('search')).toBe(true);
      expect(metrics.toolMetrics.has('fetch')).toBe(true);
    });

    it('should get tool usage stats sorted by calls', () => {
      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'fetch',
        params: {},
        durationMs: 100,
        success: true,
      });

      const stats = collector.getToolUsageStats();

      expect(stats).toHaveLength(2);
      expect(stats[0].toolName).toBe('search');
      expect(stats[0].metrics.totalCalls).toBe(2);
      expect(stats[1].toolName).toBe('fetch');
      expect(stats[1].metrics.totalCalls).toBe(1);
    });
  });

  describe('LLM Metrics', () => {
    it('should calculate LLM metrics', () => {
      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cost: 0.01,
      });

      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'anthropic',
        model: 'claude-3',
        promptTokens: 150,
        completionTokens: 75,
        durationMs: 300,
        cost: 0.015,
      });

      const metrics = collector.getMetrics('agent-1');
      const llmMetrics = metrics.llmMetrics;

      expect(llmMetrics.totalCalls).toBe(2);
      expect(llmMetrics.totalPromptTokens).toBe(250);
      expect(llmMetrics.totalCompletionTokens).toBe(125);
      expect(llmMetrics.totalCost).toBe(0.025);
      expect(llmMetrics.averageDurationMs).toBe(250);
    });

    it('should track model usage', () => {
      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });

      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });

      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'anthropic',
        model: 'claude-3',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });

      const metrics = collector.getMetrics('agent-1');
      const llmMetrics = metrics.llmMetrics;

      expect(llmMetrics.modelUsage['openai/gpt-4']).toBe(2);
      expect(llmMetrics.modelUsage['anthropic/claude-3']).toBe(1);
    });

    it('should calculate cache hit rate', () => {
      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cacheHit: true,
      });

      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cacheHit: false,
      });

      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cacheHit: false,
      });

      const metrics = collector.getMetrics('agent-1');

      expect(metrics.llmMetrics.cacheHitRate).toBeCloseTo(33.33, 1);
    });

    it('should get LLM usage stats', () => {
      logger.logLLMCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cost: 0.01,
      });

      const stats = collector.getLLMUsageStats();

      expect(stats.totalCalls).toBe(1);
      expect(stats.totalPromptTokens).toBe(100);
      expect(stats.totalCompletionTokens).toBe(50);
      expect(stats.totalCost).toBe(0.01);
    });
  });

  describe('Metrics Summary', () => {
    it('should generate summary metrics', () => {
      logger.logDecision({
        timestamp: 1000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      logger.logDecision({
        timestamp: 2000,
        agentId: 'agent-2',
        sessionId: 'session-2',
        reasoning: 'Test',
      });

      logger.logToolCall({
        timestamp: 3000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      logger.logLLMCall({
        timestamp: 4000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
        cost: 0.01,
      });

      const summary = collector.getMetricsSummary();

      expect(summary.totalEvents).toBe(4);
      expect(summary.activeAgents).toBe(2);
      expect(summary.activeSessions).toBe(2);
      expect(summary.totalTokensUsed).toBe(150);
      expect(summary.totalCost).toBe(0.01);
      expect(summary.averageSuccessRate).toBe(100);
      expect(summary.timeRange.start).toBe(1000);
      expect(summary.timeRange.end).toBe(4000);
    });

    it('should count events by type', () => {
      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: {},
        durationMs: 100,
        success: true,
      });

      const summary = collector.getMetricsSummary();

      expect(summary.eventsByType.decision).toBe(2);
      expect(summary.eventsByType.tool_call).toBe(1);
    });
  });
});
