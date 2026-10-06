import { describe, expect, it } from 'vitest';
import { AI_DISABLED_ENV, isAiDisabled, LLM_CHAT_METER_NAME } from '../ai-runtime-guards.js';

describe('isAiDisabled', () => {
  it('is disabled only when the flag is the exact string true', () => {
    expect(isAiDisabled({ [AI_DISABLED_ENV]: 'true' })).toBe(true);
    expect(isAiDisabled({})).toBe(false);
    expect(isAiDisabled({ [AI_DISABLED_ENV]: 'false' })).toBe(false);
    expect(isAiDisabled({ [AI_DISABLED_ENV]: '1' })).toBe(false);
    expect(isAiDisabled({ [AI_DISABLED_ENV]: 'TRUE' })).toBe(false);
  });

  it('publishes the llm chat meter name used as cloud cost', () => {
    expect(LLM_CHAT_METER_NAME).toBe('llm.chat');
  });
});
