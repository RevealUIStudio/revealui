import { describe, expect, it } from 'vitest';
import { normalizeClaudeCodeHookEvent } from '../hooks/normalizers/claude-code.js';
import { normalizeCursorHookEvent } from '../hooks/normalizers/cursor.js';
import { isImplementedHookSource, normalizeHookEvent } from '../hooks/normalizers/index.js';

describe('normalizeCursorHookEvent', () => {
  it('maps sessionStart to session-start', () => {
    const event = normalizeCursorHookEvent(
      { hook_event_name: 'sessionStart', conversation_id: 'c1' },
      'advisory',
    );
    expect(event.kind).toBe('session-start');
    expect(event.source).toBe('cursor');
    expect(event.identity.conversationId).toBe('c1');
  });

  it('maps sessionEnd to session-end and subagent events to nested session boundaries', () => {
    expect(normalizeCursorHookEvent({ hook_event_name: 'sessionEnd' }, 'advisory').kind).toBe(
      'session-end',
    );
    expect(normalizeCursorHookEvent({ hook_event_name: 'subagentStart' }, 'advisory').kind).toBe(
      'session-start',
    );
    expect(normalizeCursorHookEvent({ hook_event_name: 'subagentStop' }, 'advisory').kind).toBe(
      'session-end',
    );
  });

  it('maps preToolUse/postToolUse to pre-tool/post-tool with toolName', () => {
    const pre = normalizeCursorHookEvent(
      { hook_event_name: 'preToolUse', tool_name: 'Shell' },
      'advisory',
    );
    expect(pre.kind).toBe('pre-tool');
    expect(pre.toolName).toBe('Shell');

    const post = normalizeCursorHookEvent(
      { hook_event_name: 'postToolUse', tool_name: 'Write' },
      'advisory',
    );
    expect(post.kind).toBe('post-tool');
    expect(post.toolName).toBe('Write');
  });

  it('maps beforeShellExecution/afterShellExecution to pre-shell/post-shell with command', () => {
    const before = normalizeCursorHookEvent(
      { hook_event_name: 'beforeShellExecution', command: 'rm -rf /' },
      'advisory',
    );
    expect(before.kind).toBe('pre-shell');
    expect(before.command).toBe('rm -rf /');

    const after = normalizeCursorHookEvent(
      { hook_event_name: 'afterShellExecution', command: 'ls' },
      'advisory',
    );
    expect(after.kind).toBe('post-shell');
    expect(after.command).toBe('ls');
  });

  it('maps beforeMCPExecution/afterMCPExecution to pre-mcp/post-mcp', () => {
    expect(
      normalizeCursorHookEvent({ hook_event_name: 'beforeMCPExecution' }, 'advisory').kind,
    ).toBe('pre-mcp');
    expect(
      normalizeCursorHookEvent({ hook_event_name: 'afterMCPExecution' }, 'advisory').kind,
    ).toBe('post-mcp');
  });

  it('maps beforeReadFile to pre-tool with a synthetic Read toolName and the file path', () => {
    const event = normalizeCursorHookEvent(
      { hook_event_name: 'beforeReadFile', file_path: '/repo/src/index.ts' },
      'advisory',
    );
    expect(event.kind).toBe('pre-tool');
    expect(event.toolName).toBe('Read');
    expect(event.filePaths).toEqual(['/repo/src/index.ts']);
  });

  it('maps afterFileEdit to file-edit with the file path', () => {
    const event = normalizeCursorHookEvent(
      { hook_event_name: 'afterFileEdit', file_path: '/repo/src/index.ts' },
      'advisory',
    );
    expect(event.kind).toBe('file-edit');
    expect(event.filePaths).toEqual(['/repo/src/index.ts']);
  });

  it('maps stop to stop', () => {
    expect(normalizeCursorHookEvent({ hook_event_name: 'stop' }, 'advisory').kind).toBe('stop');
  });

  it('falls back to pre-tool with the raw event name for an unrecognized event', () => {
    const event = normalizeCursorHookEvent({ hook_event_name: 'somethingNew' }, 'advisory');
    expect(event.kind).toBe('pre-tool');
    expect(event.toolName).toBe('somethingNew');
  });

  it('carries the requested enforcement tier through unchanged', () => {
    const enforced = normalizeCursorHookEvent({ hook_event_name: 'stop' }, 'enforced');
    expect(enforced.enforcementTier).toBe('enforced');
    const advisory = normalizeCursorHookEvent({ hook_event_name: 'stop' }, 'advisory');
    expect(advisory.enforcementTier).toBe('advisory');
  });

  it('preserves the untouched payload under raw', () => {
    const raw = { hook_event_name: 'stop', cursor_version: '1.2.3' };
    const event = normalizeCursorHookEvent(raw, 'advisory');
    expect(event.raw).toBe(raw);
  });

  // Design invariant I-1: editor-supplied identity strings never surface as
  // normalized identity fields, even when the payload includes one.
  it('I-1: never copies user_email onto the normalized identity', () => {
    const event = normalizeCursorHookEvent(
      {
        hook_event_name: 'preToolUse',
        tool_name: 'Shell',
        user_email: 'attacker@example.com',
        conversation_id: 'c1',
        generation_id: 'g1',
        model_id: 'gpt-5',
      },
      'advisory',
    );
    expect(event.identity).toEqual({
      conversationId: 'c1',
      generationId: 'g1',
      modelId: 'gpt-5',
    });
    expect(Object.keys(event.identity)).not.toContain('email');
    expect(Object.keys(event.identity)).not.toContain('userEmail');
    // The email is still readable off raw (display metadata), never off identity.
    expect((event.raw as { user_email: string }).user_email).toBe('attacker@example.com');
  });

  it('handles a non-object payload without throwing', () => {
    expect(() => normalizeCursorHookEvent(null, 'advisory')).not.toThrow();
    expect(() => normalizeCursorHookEvent('not an object', 'advisory')).not.toThrow();
    expect(() => normalizeCursorHookEvent(undefined, 'advisory')).not.toThrow();
  });
});

describe('normalizeClaudeCodeHookEvent', () => {
  it('maps SessionStart/SessionEnd/UserPromptSubmit/Stop to their canonical kinds', () => {
    expect(normalizeClaudeCodeHookEvent({ hook_event_name: 'SessionStart' }, 'advisory').kind).toBe(
      'session-start',
    );
    expect(normalizeClaudeCodeHookEvent({ hook_event_name: 'SessionEnd' }, 'advisory').kind).toBe(
      'session-end',
    );
    expect(
      normalizeClaudeCodeHookEvent({ hook_event_name: 'UserPromptSubmit' }, 'advisory').kind,
    ).toBe('prompt-submit');
    expect(normalizeClaudeCodeHookEvent({ hook_event_name: 'Stop' }, 'advisory').kind).toBe('stop');
  });

  it('maps a generic PreToolUse/PostToolUse to pre-tool/post-tool with toolName', () => {
    const pre = normalizeClaudeCodeHookEvent(
      { hook_event_name: 'PreToolUse', tool_name: 'Read', session_id: 's1' },
      'advisory',
    );
    expect(pre.kind).toBe('pre-tool');
    expect(pre.toolName).toBe('Read');
    expect(pre.identity.conversationId).toBe('s1');

    const post = normalizeClaudeCodeHookEvent(
      { hook_event_name: 'PostToolUse', tool_name: 'Grep' },
      'advisory',
    );
    expect(post.kind).toBe('post-tool');
  });

  it('maps Bash tool calls to pre-shell/post-shell with the command', () => {
    const pre = normalizeClaudeCodeHookEvent(
      {
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
      },
      'advisory',
    );
    expect(pre.kind).toBe('pre-shell');
    expect(pre.command).toBe('rm -rf /');

    const post = normalizeClaudeCodeHookEvent(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      },
      'advisory',
    );
    expect(post.kind).toBe('post-shell');
  });

  it('maps a post-hoc Edit/Write to file-edit with the file path', () => {
    const event = normalizeClaudeCodeHookEvent(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: '/repo/src/index.ts' },
      },
      'advisory',
    );
    expect(event.kind).toBe('file-edit');
    expect(event.filePaths).toEqual(['/repo/src/index.ts']);
  });

  it('never populates generationId/modelId -- Claude Code hook payloads carry neither', () => {
    const event = normalizeClaudeCodeHookEvent(
      { hook_event_name: 'PreToolUse', tool_name: 'Read' },
      'advisory',
    );
    expect(event.identity.generationId).toBeUndefined();
    expect(event.identity.modelId).toBeUndefined();
  });

  it('falls back to pre-tool with the raw event name for an unrecognized event', () => {
    const event = normalizeClaudeCodeHookEvent({ hook_event_name: 'SomeFutureEvent' }, 'advisory');
    expect(event.kind).toBe('pre-tool');
    expect(event.toolName).toBe('SomeFutureEvent');
  });
});

describe('normalizeHookEvent dispatch', () => {
  it('isImplementedHookSource is true for cursor and claude-code, false otherwise', () => {
    expect(isImplementedHookSource('cursor')).toBe(true);
    expect(isImplementedHookSource('claude-code')).toBe(true);
    expect(isImplementedHookSource('vscode')).toBe(false);
    expect(isImplementedHookSource('opencode')).toBe(false);
    expect(isImplementedHookSource('something-else')).toBe(false);
  });

  it('dispatches to the cursor normalizer', () => {
    const event = normalizeHookEvent('cursor', { hook_event_name: 'stop' }, 'advisory');
    expect(event.source).toBe('cursor');
    expect(event.kind).toBe('stop');
  });

  it('dispatches to the claude-code normalizer', () => {
    const event = normalizeHookEvent('claude-code', { hook_event_name: 'Stop' }, 'advisory');
    expect(event.source).toBe('claude-code');
    expect(event.kind).toBe('stop');
  });
});
