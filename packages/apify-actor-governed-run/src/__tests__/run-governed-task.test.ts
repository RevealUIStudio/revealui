import type { LLMResponse, Tool } from '@revealui/ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { runGovernedTask } from '../agent/run-governed-task.js';

const echoTool: Tool = {
  name: 'echo',
  description: 'Echo back the given text',
  parameters: z.object({ text: z.string() }),
  async execute(params: unknown) {
    const { text } = params as { text: string };
    return { success: true, content: text };
  },
};

function response(overrides: Partial<LLMResponse>): LLMResponse {
  return { content: '', role: 'assistant', ...overrides };
}

describe('runGovernedTask', () => {
  it('records a model call and stops when the model returns no tool calls', async () => {
    const chat = vi.fn().mockResolvedValue(response({ content: 'the final answer' }));
    const chargeAction = vi.fn().mockResolvedValue(true);

    const result = await runGovernedTask({ task: 'say hi', tools: [], chat, chargeAction });

    expect(result.output).toBe('the final answer');
    expect(result.stopReason).toBe('completed');
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chargeAction).toHaveBeenCalledTimes(1);
    expect(result.actionLog.map((entry) => entry.type)).toEqual(['model_call', 'final_output']);
  });

  it('records an interleaved model call + tool call, then the final answer', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          content: '',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'echo', arguments: '{"text":"hi"}' },
            },
          ],
          finishReason: 'tool_calls',
        }),
      )
      .mockResolvedValueOnce(response({ content: 'done: hi' }));
    const chargeAction = vi.fn().mockResolvedValue(true);

    const result = await runGovernedTask({
      task: 'echo hi',
      tools: [echoTool],
      chat,
      chargeAction,
    });

    expect(result.output).toBe('done: hi');
    expect(result.stopReason).toBe('completed');
    expect(result.actionLog.map((entry) => entry.type)).toEqual([
      'model_call',
      'tool_call',
      'model_call',
      'final_output',
    ]);
    expect(chargeAction).toHaveBeenCalledTimes(3); // model, tool, model
  });

  it('records an error entry for an unknown tool without calling execute', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          toolCalls: [
            { id: 'call-1', type: 'function', function: { name: 'nonexistent', arguments: '{}' } },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ content: 'ok' }));
    const chargeAction = vi.fn().mockResolvedValue(true);

    const result = await runGovernedTask({ task: 'x', tools: [], chat, chargeAction });

    const toolEntry = result.actionLog.find((entry) => entry.type === 'tool_call');
    expect(toolEntry?.detail.success).toBe(false);
    expect(String(toolEntry?.detail.error)).toMatch(/unknown or disallowed tool/);
  });

  it('stops with charge-limit when the budget is exhausted before a model call', async () => {
    const chat = vi.fn();
    const chargeAction = vi.fn().mockResolvedValue(false);

    const result = await runGovernedTask({ task: 'x', tools: [], chat, chargeAction });

    expect(result.stopReason).toBe('charge-limit');
    expect(chat).not.toHaveBeenCalled();
    expect(result.output).toMatch(/charge budget/);
  });

  it('stops with max-steps when the loop never returns a final answer', async () => {
    const chat = vi.fn().mockResolvedValue(
      response({
        toolCalls: [
          { id: 'call-1', type: 'function', function: { name: 'echo', arguments: '{"text":"x"}' } },
        ],
      }),
    );
    const chargeAction = vi.fn().mockResolvedValue(true);

    const result = await runGovernedTask({
      task: 'x',
      tools: [echoTool],
      maxSteps: 2,
      chat,
      chargeAction,
    });

    expect(result.stopReason).toBe('max-steps');
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('never records an undefined value inside an action log detail (canonicalization safety)', async () => {
    const chat = vi.fn().mockResolvedValue(response({ content: 'ok', finishReason: 'stop' }));
    const chargeAction = vi.fn().mockResolvedValue(true);

    const result = await runGovernedTask({ task: 'x', tools: [], chat, chargeAction });

    for (const entry of result.actionLog) {
      for (const value of Object.values(entry.detail)) {
        expect(value).not.toBeUndefined();
      }
    }
  });
});
