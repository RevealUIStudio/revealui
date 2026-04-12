import { describe, expect, it } from 'vitest';
import { deriveSessionId } from '../workboard/session-identity.js';

describe('deriveSessionId', () => {
  it('returns type-1 when no existing sessions of that type', () => {
    expect(deriveSessionId('zed', [])).toBe('zed-1');
    expect(deriveSessionId('terminal', [])).toBe('terminal-1');
    expect(deriveSessionId('cursor', [])).toBe('cursor-1');
  });

  it('increments N beyond the highest existing', () => {
    expect(deriveSessionId('zed', ['zed-1', 'terminal-1'])).toBe('zed-2');
    expect(deriveSessionId('terminal', ['terminal-1', 'terminal-2'])).toBe('terminal-3');
  });

  it('ignores sessions of other types', () => {
    expect(deriveSessionId('cursor', ['zed-1', 'terminal-2'])).toBe('cursor-1');
  });

  it('handles non-numeric suffixes gracefully', () => {
    // Should not throw; malformed ids are ignored.
    expect(deriveSessionId('zed', ['zed-x', 'zed-1'])).toBe('zed-2');
  });

  // VAUGHN Phase 2a: new session types
  it('supports claude session type', () => {
    expect(deriveSessionId('claude', [])).toBe('claude-1');
    expect(deriveSessionId('claude', ['claude-1'])).toBe('claude-2');
  });

  it('supports codex session type', () => {
    expect(deriveSessionId('codex', [])).toBe('codex-1');
    expect(deriveSessionId('codex', ['codex-1', 'codex-2'])).toBe('codex-3');
  });
});
