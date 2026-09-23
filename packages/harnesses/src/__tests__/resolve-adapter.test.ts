import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeGenericHookEvent } from '../hooks/normalizers/generic.js';
import {
  renderSessionAdapterLines,
  resolveSessionAdapter,
  writeThinAdapterPointer,
} from '../session/resolve-adapter.js';

describe('resolveSessionAdapter', () => {
  it('uses the registered grok adapter after the control layer', () => {
    const plan = resolveSessionAdapter('grok');
    expect(plan?.mode).toBe('existing');
    expect(plan?.hookSource).toBe('grok');
    expect(renderSessionAdapterLines(plan!)).toContain('[control-layer] first');
    expect(renderSessionAdapterLines(plan!)).toContain('[memory] first: knowledge-graph');
    expect(renderSessionAdapterLines(plan!)).toContain('existing');
  });

  it('maps claude onto the claude-code adapter', () => {
    expect(resolveSessionAdapter('Claude')?.vendor).toBe('claude-code');
  });

  it('creates a thin adapter for an unknown vendor', () => {
    const plan = resolveSessionAdapter('windsurf');
    expect(plan).toEqual({
      mode: 'created',
      vendor: 'windsurf',
      generatorId: null,
      hookSource: 'generic',
    });
  });

  it('rejects a path-shaped vendor', () => {
    expect(resolveSessionAdapter('../etc')).toBeNull();
  });

  it('does not replace an existing pointer', () => {
    const root = mkdtempSync(join(tmpdir(), 'adapter-'));
    expect(writeThinAdapterPointer(root, 'windsurf')).toBe('.revealui/adapters/windsurf.md');
    expect(() => writeThinAdapterPointer(root, 'windsurf')).toThrow();
  });
});

describe('normalizeGenericHookEvent', () => {
  it('maps a pre-tool payload onto the control-layer event', () => {
    const event = normalizeGenericHookEvent(
      { hook_event_name: 'pre_tool_use', tool_name: 'grep', session_id: 's1' },
      'advisory',
    );
    expect(event.source).toBe('generic');
    expect(event.kind).toBe('pre-tool');
    expect(event.toolName).toBe('grep');
    expect(event.identity.conversationId).toBe('s1');
  });
});
