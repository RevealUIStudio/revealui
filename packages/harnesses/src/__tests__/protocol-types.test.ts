import { describe, expect, it } from 'vitest';
import {
  ALL_KNOWN_PROFILES,
  createDefaultCapabilities,
  createEventEnvelope,
  getDegradationStrategy,
  PROTOCOL_EVENTS,
  PROTOCOL_VERSION,
  protocolEventEnvelopeSchema,
  protocolEventSchema,
  ROADMAP_PROFILES,
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
});

describe('TOOL_PROFILES (shipped adapters)', () => {
  it('contains cursor, opencode, and revealui-agent', () => {
    expect(Object.keys(TOOL_PROFILES).sort()).toEqual(['cursor', 'opencode', 'revealui-agent']);
  });

  it('revealui-agent has full dispatch capabilities', () => {
    const caps = TOOL_PROFILES['revealui-agent'];
    expect(caps).toBeDefined();
    expect(caps.dispatch.generateCode).toBe(true);
    expect(caps.dispatch.analyzeCode).toBe(true);
    expect(caps.dispatch.applyEdit).toBe(true);
    expect(caps.dispatch.executeCommand).toBe(true);
  });

  it('revealui-agent supports all 10 canonical lifecycle events', () => {
    const caps = TOOL_PROFILES['revealui-agent'];
    expect(caps.lifecycleEvents).toHaveLength(10);
  });

  it('opencode is headless/resumable/forkable/backgroundable but has no hooks', () => {
    const caps = TOOL_PROFILES.opencode;
    expect(caps).toBeDefined();
    expect(caps.dispatch.generateCode).toBe(true);
    expect(caps.dispatch.analyzeCode).toBe(true);
    expect(caps.dispatch.applyEdit).toBe(false);
    expect(caps.dispatch.executeCommand).toBe(true);
    expect(caps.headless).toBe(true);
    expect(caps.resumable).toBe(true);
    expect(caps.forkable).toBe(true);
    expect(caps.backgroundable).toBe(true);
    expect(caps.hooks.supported).toBe(false);
    expect(caps.hooks.canBlock).toBe(false);
    expect(caps.supportsSkills).toBe(true);
    expect(caps.supportsMcp).toBe(true);
    expect(caps.supportsWorktrees).toBe(false);
    // 0 is the documented BYO-model sentinel for opencode (see the
    // maxContextTokens doc comment on ProtocolCapabilities), not a defect.
    expect(caps.maxContextTokens).toBe(0);
  });

  it('cursor is headless/backgroundable, supports hooks + MCP, and carries the roadmap maxContextTokens', () => {
    const caps = TOOL_PROFILES.cursor;
    expect(caps).toBeDefined();
    expect(caps.dispatch.generateCode).toBe(true);
    expect(caps.dispatch.analyzeCode).toBe(true);
    expect(caps.dispatch.applyEdit).toBe(false);
    expect(caps.dispatch.executeCommand).toBe(true);
    expect(caps.headless).toBe(true);
    expect(caps.backgroundable).toBe(true);
    expect(caps.hooks.supported).toBe(true);
    expect(caps.hooks.canBlock).toBe(true);
    expect(caps.supportsMcp).toBe(true);
    // 128_000 is the real value the roadmap profile already declared, kept
    // on promotion per the maxContextTokens doc comment ("do not invent a
    // number") -- NOT the `0` BYO sentinel opencode uses.
    expect(caps.maxContextTokens).toBe(128_000);
  });

  it('does not contain entries for tools without adapters', () => {
    expect(TOOL_PROFILES['claude-code']).toBeUndefined();
    expect(TOOL_PROFILES.codex).toBeUndefined();
  });
});

describe('ROADMAP_PROFILES (declared, no adapter)', () => {
  it('contains the two remaining spec-declared tools (opencode + cursor graduated to TOOL_PROFILES)', () => {
    expect(Object.keys(ROADMAP_PROFILES).sort()).toEqual(['claude-code', 'codex']);
  });

  it('claude-code has no dispatch capabilities (interactive tool)', () => {
    const caps = ROADMAP_PROFILES['claude-code'];
    expect(caps.dispatch.generateCode).toBe(false);
    expect(caps.dispatch.analyzeCode).toBe(false);
  });

  it('codex has sandbox support', () => {
    const caps = ROADMAP_PROFILES.codex;
    expect(caps.sandbox.supported).toBe(true);
    expect(caps.sandbox.modes).toContain('read-only');
  });

  it('no longer declares cursor (graduated to TOOL_PROFILES)', () => {
    expect(ROADMAP_PROFILES.cursor).toBeUndefined();
  });

  it('does not overlap with TOOL_PROFILES', () => {
    for (const id of Object.keys(ROADMAP_PROFILES)) {
      expect(TOOL_PROFILES[id]).toBeUndefined();
    }
  });
});

describe('ALL_KNOWN_PROFILES (merged view)', () => {
  it('contains all five declared tools', () => {
    expect(Object.keys(ALL_KNOWN_PROFILES).sort()).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'opencode',
      'revealui-agent',
    ]);
  });

  it('shipped entries take precedence over roadmap entries on key collision', () => {
    // No collision today (the five IDs are disjoint), but the spread order
    // (...ROADMAP_PROFILES first, then ...TOOL_PROFILES) guarantees that
    // a future shipped adapter overrides any roadmap declaration with the
    // same ID. Verify the shape of the shipped profiles matches TOOL_PROFILES.
    expect(ALL_KNOWN_PROFILES['revealui-agent']).toEqual(TOOL_PROFILES['revealui-agent']);
    expect(ALL_KNOWN_PROFILES.opencode).toEqual(TOOL_PROFILES.opencode);
    expect(ALL_KNOWN_PROFILES.cursor).toEqual(TOOL_PROFILES.cursor);
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

  it('returns absent for opencode per-tool events (no hooks) and polyfill for lifecycle events', () => {
    expect(getDegradationStrategy('opencode', 'tool.before')).toBe('absent');
    expect(getDegradationStrategy('opencode', 'tool.after')).toBe('absent');
    expect(getDegradationStrategy('opencode', 'tool.blocked')).toBe('absent');
    expect(getDegradationStrategy('opencode', 'session.start')).toBe('polyfill');
    expect(getDegradationStrategy('opencode', 'agent.heartbeat')).toBe('polyfill');
  });

  it('revealui-agent has no degradation for any event', () => {
    for (const event of PROTOCOL_EVENTS) {
      expect(getDegradationStrategy('revealui-agent', event)).toBeUndefined();
    }
  });
});
