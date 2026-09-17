import { describe, expect, it } from 'vitest';

import { noSandboxProvider } from '../no-sandbox-provider.js';
import { REVMARKET_PREVIEW_STUB_ERROR } from '../types.js';

describe('noSandboxProvider default stub', () => {
  it('fails closed instead of faking a successful skill run', async () => {
    const provider = noSandboxProvider();
    const result = await provider.run({
      taskId: 'task-preview',
      agentId: 'agent-preview',
      skillName: 'echo',
      input: { hello: 'world' },
      signal: new AbortController().signal,
      maxMemoryMb: 64,
      maxExecMs: 1_000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(REVMARKET_PREVIEW_STUB_ERROR);
    expect(result.output).toMatchObject({
      taskId: 'task-preview',
      skillName: 'echo',
      status: 'preview-not-executed',
    });
  });
});
