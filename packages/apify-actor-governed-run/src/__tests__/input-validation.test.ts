import { describe, expect, it } from 'vitest';
import { parseActorInput } from '../types.js';

describe('parseActorInput', () => {
  it('accepts a valid run-task input and defaults mode', () => {
    const input = parseActorInput({
      task: 'summarize https://example.com',
      llmProvider: 'anthropic',
      llmApiKey: 'sk-test-key',
    });
    expect(input.mode).toBe('run-task');
    if (input.mode === 'run-task') {
      expect(input.task).toBe('summarize https://example.com');
      expect(input.llmProvider).toBe('anthropic');
    }
  });

  it('accepts groq as a run-task provider', () => {
    const input = parseActorInput({
      task: 'reply ok',
      llmProvider: 'groq',
      llmApiKey: 'gsk-test-key',
    });
    expect(input.mode).toBe('run-task');
    if (input.mode === 'run-task') {
      expect(input.llmProvider).toBe('groq');
    }
  });

  it('accepts xai as a run-task provider', () => {
    const input = parseActorInput({
      task: 'reply ok',
      llmProvider: 'xai',
      llmApiKey: 'xai-test-key',
    });
    expect(input.mode).toBe('run-task');
    if (input.mode === 'run-task') {
      expect(input.llmProvider).toBe('xai');
    }
  });

  it('accepts an explicit run-task input with all optional fields', () => {
    const input = parseActorInput({
      mode: 'run-task',
      task: 'do the thing',
      llmProvider: 'openai',
      llmApiKey: 'sk-test-key',
      model: 'gpt-5',
      toolAllowlist: ['web_fetch'],
      maxSteps: 5,
    });
    expect(input.mode).toBe('run-task');
  });

  it('accepts a valid verify-receipt input', () => {
    const input = parseActorInput({
      mode: 'verify-receipt',
      receipt: {
        actionLog: [],
        signature: 'x',
        publicKey: 'y',
        algorithm: 'ed25519',
        timestamp: 'z',
      },
    });
    expect(input.mode).toBe('verify-receipt');
  });

  it('rejects run-task input missing task', () => {
    expect(() => parseActorInput({ llmProvider: 'anthropic', llmApiKey: 'sk-test' })).toThrow(
      /invalid actor input/,
    );
  });

  it('rejects run-task input missing llmApiKey', () => {
    expect(() => parseActorInput({ task: 'x', llmProvider: 'anthropic' })).toThrow(
      /invalid actor input/,
    );
  });

  it('rejects run-task input with an unsupported provider', () => {
    expect(() =>
      parseActorInput({ task: 'x', llmProvider: 'gemini', llmApiKey: 'sk-test' }),
    ).toThrow(/invalid actor input/);
  });

  it('rejects an empty task string', () => {
    expect(() =>
      parseActorInput({ task: '', llmProvider: 'anthropic', llmApiKey: 'sk-test' }),
    ).toThrow(/invalid actor input/);
  });

  it('rejects maxSteps above the ceiling', () => {
    expect(() =>
      parseActorInput({
        task: 'x',
        llmProvider: 'anthropic',
        llmApiKey: 'sk-test',
        maxSteps: 51,
      }),
    ).toThrow(/invalid actor input/);
  });

  it('rejects verify-receipt input missing receipt', () => {
    expect(() => parseActorInput({ mode: 'verify-receipt' })).toThrow(/invalid actor input/);
  });

  it('rejects completely empty input', () => {
    expect(() => parseActorInput({})).toThrow(/invalid actor input/);
  });

  it('rejects null input', () => {
    expect(() => parseActorInput(null)).toThrow(/invalid actor input/);
  });
});
