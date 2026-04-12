import { describe, expect, it } from 'vitest';
import type { HarnessEvent } from '../types/core.js';
import { VaughnEventNormalizer } from '../vaughn/event-normalizer.js';

describe('VaughnEventNormalizer', () => {
  const normalizer = new VaughnEventNormalizer('claude-code', 'claude-root', 'sess-1');

  describe('harness-connected -> session.start', () => {
    it('normalizes to session.start', () => {
      const event: HarnessEvent = { type: 'harness-connected', harnessId: 'claude-code' };
      const result = normalizer.normalize(event);
      expect(result).not.toBeNull();
      expect(result?.envelope.event).toBe('session.start');
      expect(result?.envelope.agentId).toBe('claude-root');
      expect(result?.envelope.toolName).toBe('claude-code');
      expect(result?.envelope.sessionId).toBe('sess-1');
      expect(result?.envelope.payload.harnessId).toBe('claude-code');
      expect(result?.degradation).toBeUndefined();
    });
  });

  describe('harness-disconnected -> session.stop', () => {
    it('normalizes to session.stop', () => {
      const event: HarnessEvent = { type: 'harness-disconnected', harnessId: 'claude-code' };
      const result = normalizer.normalize(event);
      expect(result?.envelope.event).toBe('session.stop');
      expect(result?.envelope.payload.harnessId).toBe('claude-code');
      expect(result?.degradation).toBeUndefined();
    });
  });

  describe('generation-started -> tool.before', () => {
    it('normalizes to tool.before', () => {
      const event: HarnessEvent = { type: 'generation-started', taskId: 'task-1' };
      const result = normalizer.normalize(event);
      expect(result?.envelope.event).toBe('tool.before');
      expect(result?.envelope.payload.taskId).toBe('task-1');
    });
  });

  describe('generation-completed -> tool.after', () => {
    it('normalizes to tool.after with output', () => {
      const event: HarnessEvent = {
        type: 'generation-completed',
        taskId: 'task-1',
        output: 'done',
      };
      const result = normalizer.normalize(event);
      expect(result?.envelope.event).toBe('tool.after');
      expect(result?.envelope.payload.taskId).toBe('task-1');
      expect(result?.envelope.payload.output).toBe('done');
    });
  });

  describe('error -> session.crash', () => {
    it('normalizes error to session.crash with polyfill degradation', () => {
      const event: HarnessEvent = {
        type: 'error',
        harnessId: 'claude-code',
        message: 'something broke',
      };
      const result = normalizer.normalize(event);
      expect(result?.envelope.event).toBe('session.crash');
      expect(result?.envelope.payload.message).toBe('something broke');
      // session.crash is polyfilled for claude-code
      expect(result?.degradation).toBe('polyfill');
      expect(result?.envelope.payload.degraded).toBe(true);
      expect(result?.envelope.payload.degradationStrategy).toBe('polyfill');
    });
  });

  describe('envelope metadata', () => {
    it('sets version to 0.1.0', () => {
      const event: HarnessEvent = { type: 'harness-connected', harnessId: 'test' };
      const result = normalizer.normalize(event);
      expect(result?.envelope.version).toBe('0.1.0');
    });

    it('sets a valid ISO timestamp', () => {
      const event: HarnessEvent = { type: 'harness-connected', harnessId: 'test' };
      const result = normalizer.normalize(event);
      expect(result?.envelope.timestamp).toBeTruthy();
      expect(Number.isNaN(Date.parse(result!.envelope.timestamp))).toBe(false);
    });
  });

  describe('normalizeToEnvelope', () => {
    it('returns just the envelope', () => {
      const event: HarnessEvent = { type: 'harness-connected', harnessId: 'test' };
      const envelope = normalizer.normalizeToEnvelope(event);
      expect(envelope?.event).toBe('session.start');
    });

    it('returns null for unmapped events', () => {
      // Cast to force an unknown event type
      const event = { type: 'unknown-event' } as unknown as HarnessEvent;
      const envelope = normalizer.normalizeToEnvelope(event);
      expect(envelope).toBeNull();
    });
  });

  describe('cursor degradation (absent events)', () => {
    const cursorNormalizer = new VaughnEventNormalizer('cursor', 'cursor-1', 'sess-c');

    it('returns null for absent events', () => {
      const event: HarnessEvent = { type: 'harness-connected', harnessId: 'cursor' };
      // session.start is absent for cursor
      const result = cursorNormalizer.normalize(event);
      expect(result).toBeNull();
    });

    it('normalizes error to session.crash with polyfill', () => {
      const event: HarnessEvent = {
        type: 'error',
        harnessId: 'cursor',
        message: 'crash',
      };
      const result = cursorNormalizer.normalize(event);
      // session.crash is polyfilled for cursor
      expect(result?.envelope.event).toBe('session.crash');
      expect(result?.degradation).toBe('polyfill');
    });
  });

  describe('revealui-agent (no degradation)', () => {
    const agentNormalizer = new VaughnEventNormalizer('revealui-agent', 'agent-1', 'sess-a');

    it('normalizes all events without degradation', () => {
      const events: HarnessEvent[] = [
        { type: 'harness-connected', harnessId: 'revealui-agent' },
        { type: 'harness-disconnected', harnessId: 'revealui-agent' },
        { type: 'generation-started', taskId: 't1' },
        { type: 'generation-completed', taskId: 't1', output: 'ok' },
        { type: 'error', harnessId: 'revealui-agent', message: 'err' },
      ];

      for (const event of events) {
        const result = agentNormalizer.normalize(event);
        expect(result).not.toBeNull();
        expect(result?.degradation).toBeUndefined();
        expect(result?.envelope.payload.degraded).toBeUndefined();
      }
    });
  });
});
