import { describe, expect, it } from 'vitest';
import {
  createDefaultCapabilities,
  createEventEnvelope,
  getDegradationStrategy,
  PROTOCOL_EVENTS,
  PROTOCOL_VERSION,
  protocolEventEnvelopeSchema,
  protocolEventSchema,
  TOOL_PROFILES,
} from '../protocol/index.js';

describe('protocol capabilities', () => {
  it('createDefaultCapabilities returns all-false defaults', () => {
    const caps = createDefaultCapabilities();
    expect(caps.dispatch.generateCode).toBe(false);
    expect(caps.dispatch.analyzeCode).toBe(false);
    expect(caps.dispatch.applyEdit).toBe(false);
    expect(caps.dispatch.executeCommand).toBe(false);
    expect(caps.readWorkboard).toBe(false);
    expect(caps.writeWorkboard).toBe(false);
    expect(caps.claimTasks).toBe(false);
    expect(caps.headless).toBe(false);
    expect(caps.hooks.supported).toBe(false);
    expect(caps.hooks.granularity).toBe('none');
    expect(caps.sandbox.supported).toBe(false);
    expect(caps.sandbox.modes).toEqual([]);
    expect(caps.supportsWorktrees).toBe(false);
    expect(caps.memory.backend).toBe('none');
    expect(caps.maxContextTokens).toBe(0);
    expect(caps.lifecycleEvents).toEqual([]);
  });

  it('TOOL_PROFILES has entries for all known tools', () => {
    expect(TOOL_PROFILES['claude-code']).toBeDefined();
    expect(TOOL_PROFILES.codex).toBeDefined();
    expect(TOOL_PROFILES.cursor).toBeDefined();
    expect(TOOL_PROFILES['revealui-agent']).toBeDefined();
  });

  it('revealui-agent has full dispatch capabilities', () => {
    const caps = TOOL_PROFILES['revealui-agent'];
    expect(caps.dispatch.generateCode).toBe(true);
    expect(caps.dispatch.analyzeCode).toBe(true);
    expect(caps.dispatch.applyEdit).toBe(true);
    expect(caps.dispatch.executeCommand).toBe(true);
  });

  it('claude-code does not have dispatch capabilities', () => {
    const caps = TOOL_PROFILES['claude-code'];
    expect(caps.dispatch.generateCode).toBe(false);
    expect(caps.dispatch.analyzeCode).toBe(false);
  });

  it('codex has sandbox support', () => {
    const caps = TOOL_PROFILES.codex;
    expect(caps.sandbox.supported).toBe(true);
    expect(caps.sandbox.modes).toContain('read-only');
  });

  it('cursor has minimal capabilities', () => {
    const caps = TOOL_PROFILES.cursor;
    expect(caps.headless).toBe(false);
    expect(caps.hooks.supported).toBe(false);
    expect(caps.readWorkboard).toBe(false);
    expect(caps.lifecycleEvents).toEqual([]);
  });
});

describe('protocol events', () => {
  it('PROTOCOL_EVENTS contains exactly 10 canonical events', () => {
    expect(PROTOCOL_EVENTS).toHaveLength(10);
  });

  it('PROTOCOL_VERSION is 0.1.0', () => {
    expect(PROTOCOL_VERSION).toBe('0.1.0');
  });

  it('protocolEventSchema validates valid events', () => {
    expect(protocolEventSchema.parse('session.start')).toBe('session.start');
    expect(protocolEventSchema.parse('tool.blocked')).toBe('tool.blocked');
    expect(protocolEventSchema.parse('agent.heartbeat')).toBe('agent.heartbeat');
  });

  it('protocolEventSchema rejects invalid events', () => {
    expect(() => protocolEventSchema.parse('invalid.event')).toThrow();
    expect(() => protocolEventSchema.parse('')).toThrow();
  });
});

describe('ProtocolEventEnvelope', () => {
  it('createEventEnvelope produces a valid envelope', () => {
    const envelope = createEventEnvelope('session.start', 'claude-root', 'claude-code', 'sess-1', {
      workdir: '/home/user/project',
    });

    expect(envelope.version).toBe('0.1.0');
    expect(envelope.event).toBe('session.start');
    expect(envelope.agentId).toBe('claude-root');
    expect(envelope.toolName).toBe('claude-code');
    expect(envelope.sessionId).toBe('sess-1');
    expect(envelope.payload).toEqual({ workdir: '/home/user/project' });
    expect(envelope.timestamp).toBeTruthy();
  });

  it('createEventEnvelope defaults payload to empty object', () => {
    const envelope = createEventEnvelope('agent.heartbeat', 'agent-1', 'codex', 'sess-2');
    expect(envelope.payload).toEqual({});
  });

  it('protocolEventEnvelopeSchema validates valid envelopes', () => {
    const envelope = createEventEnvelope('tool.before', 'agent-1', 'claude-code', 'sess-1', {
      tool: 'Bash',
    });
    const result = protocolEventEnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  it('protocolEventEnvelopeSchema rejects invalid version', () => {
    const bad = {
      version: '0.0.1',
      event: 'session.start',
      timestamp: new Date().toISOString(),
      agentId: 'x',
      toolName: 'y',
      sessionId: 'z',
      payload: {},
    };
    const result = protocolEventEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('protocolEventEnvelopeSchema rejects empty agentId', () => {
    const bad = {
      version: '0.1.0',
      event: 'session.start',
      timestamp: new Date().toISOString(),
      agentId: '',
      toolName: 'claude-code',
      sessionId: 'sess-1',
      payload: {},
    };
    const result = protocolEventEnvelopeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('degradation strategies', () => {
  it('returns undefined for natively supported events', () => {
    expect(getDegradationStrategy('claude-code', 'session.start')).toBeUndefined();
    expect(getDegradationStrategy('claude-code', 'tool.before')).toBeUndefined();
    expect(getDegradationStrategy('revealui-agent', 'session.crash')).toBeUndefined();
  });

  it('returns polyfill for synthesizable events', () => {
    expect(getDegradationStrategy('claude-code', 'session.crash')).toBe('polyfill');
    expect(getDegradationStrategy('claude-code', 'agent.heartbeat')).toBe('polyfill');
    expect(getDegradationStrategy('codex', 'task.claimed')).toBe('polyfill');
  });

  it('returns absent for cursor events', () => {
    expect(getDegradationStrategy('cursor', 'tool.before')).toBe('absent');
    expect(getDegradationStrategy('cursor', 'prompt.submit')).toBe('absent');
    expect(getDegradationStrategy('cursor', 'session.start')).toBe('absent');
  });

  it('returns polyfill for cursor heartbeat and crash', () => {
    expect(getDegradationStrategy('cursor', 'agent.heartbeat')).toBe('polyfill');
    expect(getDegradationStrategy('cursor', 'session.crash')).toBe('polyfill');
  });

  it('returns absent for unknown tools', () => {
    expect(getDegradationStrategy('unknown-tool', 'session.start')).toBe('absent');
  });

  it('revealui-agent has no degradation for any event', () => {
    for (const event of PROTOCOL_EVENTS) {
      expect(getDegradationStrategy('revealui-agent', event)).toBeUndefined();
    }
  });
});
