import { describe, expect, it } from 'vitest';
import { collectSkillInvokeOutput } from '../content/skill-invoke-runtime.js';

const prepared = {
  skillId: 'revealui-doctor' as const,
  model: 'gemma3' as const,
  suitability: 'unverified' as const,
  skillSha256: 'fixture',
};
async function* chunks(
  events: Parameters<typeof collectSkillInvokeOutput>[0] extends AsyncIterable<infer E>
    ? E[]
    : never,
) {
  yield* events;
}

describe('native skill execution evidence', () => {
  it('does not report a tool start as execution or an incomplete stream as success', async () => {
    const result = await collectSkillInvokeOutput(
      chunks([{ type: 'tool_call_start', toolCall: { name: 'Read' } }]),
      prepared,
    );
    expect(result.toolsExecuted).toBe(false);
    expect(result.toolsCompleted).toBe(0);
    expect(result.executionStatus).toBe('failed');
    expect(result.outputValidation).toBe('unverified');
  });
  it('keeps failed tools, stream errors, and unvalidated output explicit', async () => {
    const result = await collectSkillInvokeOutput(
      chunks([
        { type: 'tool_call_result', toolResult: { success: false } },
        { type: 'error', error: 'provider failed' },
        { type: 'done' },
      ]),
      prepared,
    );
    expect(result.toolsCompleted).toBe(1);
    expect(result.toolsSucceeded).toBe(0);
    expect(result.error).toBe('provider failed');
    expect(result.executionStatus).toBe('failed');
  });
  it('separates completed execution from malformed output', async () => {
    const result = await collectSkillInvokeOutput(
      chunks([{ type: 'text', content: 'not JSON' }, { type: 'done' }]),
      prepared,
      (text) => ({ valid: text.startsWith('{'), detail: 'Expected a JSON report' }),
    );
    expect(result.executionStatus).toBe('completed');
    expect(result.outputValidation).toBe('invalid');
    expect(result.error).toContain('failed validation');
  });
  it('leaves task suitability unverified even when a caller validates output shape', async () => {
    const result = await collectSkillInvokeOutput(
      chunks([
        { type: 'text', content: '{"status":"unknown"}' },
        { type: 'tool_call_result', toolResult: { success: true } },
        { type: 'done' },
      ]),
      prepared,
      (text) => ({
        valid: JSON.parse(text).status === 'unknown',
        detail: 'Report shape only; evidence requires review',
      }),
    );
    expect(result.outputValidation).toBe('valid');
    expect(result.suitability).toBe('unverified');
    expect(result.toolsSucceeded).toBe(1);
  });
});
