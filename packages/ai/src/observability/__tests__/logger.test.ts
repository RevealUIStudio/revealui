import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentEventLogger } from '../logger.js';
import { MemoryEventStorage } from '../storage.js';
import type { DecisionEvent } from '../types.js';

describe('AgentEventLogger', () => {
  let logger: AgentEventLogger;

  beforeEach(() => {
    logger = new AgentEventLogger({ maxEvents: 10 });
  });

  afterEach(() => {
    logger.destroy();
  });

  describe('Event Logging', () => {
    it('should log decision events', () => {
      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test reasoning',
        chosenTool: 'search',
        confidence: 0.9,
      });

      const decisions = logger.getDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0].eventType).toBe('decision');
      expect(decisions[0].reasoning).toBe('Test reasoning');
    });

    it('should log tool call events', () => {
      logger.logToolCall({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        toolName: 'search',
        params: { query: 'test' },
        durationMs: 100,
        success: true,
      });

      const toolCalls = logger.getToolCalls();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].eventType).toBe('tool_call');
      expect(toolCalls[0].toolName).toBe('search');
    });

    it('should log LLM call events', () => {
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

      const llmCalls = logger.getLLMCalls();
      expect(llmCalls).toHaveLength(1);
      expect(llmCalls[0].eventType).toBe('llm_call');
      expect(llmCalls[0].provider).toBe('openai');
    });

    it('should log error events', () => {
      logger.logError({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        message: 'Test error',
        stack: 'Error: Test error',
        recoverable: true,
      });

      const errors = logger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].eventType).toBe('error');
      expect(errors[0].message).toBe('Test error');
    });
  });

  describe('Circular Buffer', () => {
    it('should maintain max events limit', () => {
      // Add 15 events to a logger with maxEvents=10
      for (let i = 0; i < 15; i++) {
        logger.logDecision({
          timestamp: Date.now(),
          agentId: 'agent-1',
          sessionId: 'session-1',
          reasoning: `Decision ${i}`,
        });
      }

      const events = logger.getEvents();
      expect(events).toHaveLength(10);
    });

    it('should keep most recent events', () => {
      for (let i = 0; i < 15; i++) {
        logger.logDecision({
          timestamp: Date.now() + i,
          agentId: 'agent-1',
          sessionId: 'session-1',
          reasoning: `Decision ${i}`,
        });
      }

      const decisions = logger.getDecisions() as DecisionEvent[];
      expect(decisions).toHaveLength(10);
      expect(decisions[0].reasoning).toBe('Decision 5'); // First kept event
      expect(decisions[9].reasoning).toBe('Decision 14'); // Last event
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      logger.logDecision({
        timestamp: 1000,
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Decision 1',
      });

      logger.logDecision({
        timestamp: 2000,
        agentId: 'agent-2',
        sessionId: 'session-2',
        reasoning: 'Decision 2',
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
    });

    it('should filter by agentId', () => {
      const events = logger.getEvents({ agentId: 'agent-1' });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.agentId === 'agent-1')).toBe(true);
    });

    it('should filter by sessionId', () => {
      const events = logger.getEvents({ sessionId: 'session-2' });
      expect(events).toHaveLength(1);
      expect(events[0].agentId).toBe('agent-2');
    });

    it('should filter by eventType', () => {
      const events = logger.getEvents({ eventType: 'decision' });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.eventType === 'decision')).toBe(true);
    });

    it('should filter by time range', () => {
      const events = logger.getEvents({ startTime: 1500, endTime: 2500 });
      expect(events).toHaveLength(1);
      expect(events[0].timestamp).toBe(2000);
    });

    it('should combine multiple filters', () => {
      const events = logger.getEvents({
        agentId: 'agent-1',
        eventType: 'decision',
      });
      expect(events).toHaveLength(1);
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].eventType).toBe('decision');
    });
  });

  describe('Event Retrieval', () => {
    it('should get recent N events', () => {
      for (let i = 0; i < 5; i++) {
        logger.logDecision({
          timestamp: Date.now() + i,
          agentId: 'agent-1',
          sessionId: 'session-1',
          reasoning: `Decision ${i}`,
        });
      }

      const recent = logger.getRecentEvents(3);
      expect(recent).toHaveLength(3);
      expect((recent[0] as DecisionEvent).reasoning).toBe('Decision 2');
      expect((recent[2] as DecisionEvent).reasoning).toBe('Decision 4');
    });

    it('should get event count', () => {
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

      expect(logger.getCount()).toBe(2);
      expect(logger.getCount({ eventType: 'decision' })).toBe(1);
    });
  });

  describe('Storage Integration', () => {
    it('should save events to storage', async () => {
      const storage = new MemoryEventStorage();
      logger = new AgentEventLogger({ storage });

      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      await logger.flush();

      const events = await storage.load();
      expect(events).toHaveLength(1);
    });

    it('should load events from storage', async () => {
      const storage = new MemoryEventStorage();

      await storage.save([
        {
          timestamp: Date.now(),
          eventType: 'decision',
          agentId: 'agent-1',
          sessionId: 'session-1',
          reasoning: 'Test',
        } as DecisionEvent,
      ]);

      logger = new AgentEventLogger({ storage });
      await logger.load();

      const events = logger.getEvents();
      expect(events).toHaveLength(1);
    });

    it('should auto-flush when enabled', async () => {
      vi.useFakeTimers();
      const storage = new MemoryEventStorage();

      logger = new AgentEventLogger({
        storage,
        autoFlush: true,
        flushIntervalMs: 1000,
      });

      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      // Fast-forward time
      vi.advanceTimersByTime(1000);
      await Promise.resolve(); // Let flush complete

      const events = await storage.load();
      expect(events.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('Clear and Destroy', () => {
    it('should clear all events', () => {
      logger.logDecision({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test',
      });

      expect(logger.getCount()).toBe(1);
      logger.clear();
      expect(logger.getCount()).toBe(0);
    });

    it('should cleanup resources on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const storage = new MemoryEventStorage();

      logger = new AgentEventLogger({
        storage,
        autoFlush: true,
        flushIntervalMs: 1000,
      });

      logger.destroy();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
