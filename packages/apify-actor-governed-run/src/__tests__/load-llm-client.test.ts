import { describe, expect, it, vi } from 'vitest';

// Guardrail-2 hygiene finding (revealui#2198): `@revealui/ai` was declared in
// `optionalDependencies` but hard-imported at `main.ts:1` with no guard, so
// the actor could not even start without it -- the declaration didn't match
// runtime behavior. The fix makes the load genuinely lazy and the failure
// mode a clear, actionable error.

describe('loadLLMClient', () => {
  it('returns LLMClient when @revealui/ai resolves', async () => {
    vi.resetModules();
    const { loadLLMClient } = await import('../agent/load-llm-client.js');
    const LLMClient = await loadLLMClient();
    expect(typeof LLMClient).toBe('function');
  });

  it('throws a clear, actionable error when @revealui/ai cannot be loaded', async () => {
    vi.resetModules();
    vi.doMock('@revealui/ai', () => {
      throw new Error("Cannot find package '@revealui/ai'");
    });

    try {
      const { loadLLMClient } = await import('../agent/load-llm-client.js');
      await expect(loadLLMClient()).rejects.toThrow(/run-task mode requires @revealui\/ai/);
    } finally {
      vi.doUnmock('@revealui/ai');
      vi.resetModules();
    }
  });
});
