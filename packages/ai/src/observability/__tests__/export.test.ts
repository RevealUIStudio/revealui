import { beforeEach, describe, expect, it } from 'vitest';
import { EventExporter, exportToCSV, exportToJSON, exportToNDJSON } from '../export.js';
import { AgentEventLogger } from '../logger.js';
import type { DecisionEvent, ToolCallEvent } from '../types.js';

describe('Export', () => {
  let logger: AgentEventLogger;
  let events: unknown[];

  beforeEach(() => {
    logger = new AgentEventLogger();

    // Create test events
    const decision: DecisionEvent = {
      timestamp: 1000,
      eventType: 'decision',
      agentId: 'agent-1',
      sessionId: 'session-1',
      reasoning: 'Test reasoning',
      chosenTool: 'search',
      confidence: 0.95,
    };

    const toolCall: ToolCallEvent = {
      timestamp: 2000,
      eventType: 'tool_call',
      agentId: 'agent-1',
      sessionId: 'session-1',
      toolName: 'search',
      params: { query: 'test' },
      durationMs: 100,
      success: true,
    };

    events = [decision, toolCall];
    logger.logDecision(decision);
    logger.logToolCall(toolCall);
  });

  describe('exportToJSON', () => {
    it('should export events to JSON', () => {
      const json = exportToJSON(events);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].eventType).toBe('decision');
      expect(parsed[1].eventType).toBe('tool_call');
    });

    it('should export with pretty formatting', () => {
      const json = exportToJSON(events, { pretty: true });

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('should include metadata', () => {
      const json = exportToJSON(events, {
        pretty: true,
        metadata: { source: 'test' },
      });
      const parsed = JSON.parse(json);

      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.source).toBe('test');
      expect(parsed.metadata.eventCount).toBe(2);
      expect(parsed.events).toHaveLength(2);
    });
  });

  describe('exportToCSV', () => {
    it('should export events to CSV', () => {
      const csv = exportToCSV(events);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('timestamp');
      expect(lines[0]).toContain('eventType');
      expect(lines[0]).toContain('agentId');
      expect(lines.length).toBe(3); // Header + 2 events
    });

    it('should handle empty events', () => {
      const csv = exportToCSV([]);
      expect(csv).toBe('');
    });

    it('should escape commas in values', () => {
      const event: DecisionEvent = {
        timestamp: 1000,
        eventType: 'decision',
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test, with, commas',
      };

      const csv = exportToCSV([event]);
      expect(csv).toContain('"Test, with, commas"');
    });

    it('should escape quotes in values', () => {
      const event: DecisionEvent = {
        timestamp: 1000,
        eventType: 'decision',
        agentId: 'agent-1',
        sessionId: 'session-1',
        reasoning: 'Test "quoted" value',
      };

      const csv = exportToCSV([event]);
      expect(csv).toContain('""');
    });
  });

  describe('exportToNDJSON', () => {
    it('should export events to NDJSON', () => {
      const ndjson = exportToNDJSON(events);
      const lines = ndjson.split('\n');

      expect(lines).toHaveLength(2);

      const event1 = JSON.parse(lines[0]);
      const event2 = JSON.parse(lines[1]);

      expect(event1.eventType).toBe('decision');
      expect(event2.eventType).toBe('tool_call');
    });

    it('should handle empty events', () => {
      const ndjson = exportToNDJSON([]);
      expect(ndjson).toBe('');
    });
  });

  describe('EventExporter', () => {
    let exporter: EventExporter;

    beforeEach(() => {
      exporter = new EventExporter(logger);
    });

    it('should export all events', () => {
      const json = exporter.exportAll('json');
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
    });

    it('should export filtered events', () => {
      const json = exporter.exportFiltered({ eventType: 'decision' }, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].eventType).toBe('decision');
      expect(parsed.metadata.filter).toBeDefined();
    });

    it('should export by agent', () => {
      const json = exporter.exportByAgent('agent-1', 'json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(2);
    });

    it('should export by session', () => {
      const json = exporter.exportBySession('session-1', 'json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(2);
    });

    it('should export errors only', () => {
      logger.logError({
        timestamp: Date.now(),
        agentId: 'agent-1',
        sessionId: 'session-1',
        message: 'Test error',
        recoverable: true,
      });

      const json = exporter.exportErrors('json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].eventType).toBe('error');
    });

    it('should export LLM calls only', () => {
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

      const json = exporter.exportLLMCalls('json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].eventType).toBe('llm_call');
    });

    it('should export in CSV format', () => {
      const csv = exporter.exportAll('csv');
      const lines = csv.split('\n');

      expect(lines.length).toBeGreaterThan(2); // Header + events
    });

    it('should export in NDJSON format', () => {
      const ndjson = exporter.exportAll('ndjson');
      const lines = ndjson.split('\n');

      expect(lines.length).toBe(2);
    });

    it('should export time range', () => {
      const start = new Date(0);
      const end = new Date(1500);

      const json = exporter.exportTimeRange(start, end, 'json');
      const parsed = JSON.parse(json);

      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].timestamp).toBe(1000);
    });
  });
});
