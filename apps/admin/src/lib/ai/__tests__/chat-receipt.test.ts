import { describe, expect, it } from 'vitest';
import type { LlmCallReceiptInput } from '../chat-receipt';
import { buildLlmCallReceipt } from '../chat-receipt';

const base: LlmCallReceiptInput = {
  id: 'rcpt-1',
  userId: 'user-1',
  accountId: 'acct-1',
  route: 'admin.chat',
  provider: 'openai',
  model: 'gpt-4o',
  keySource: 'byok',
  promptTokens: 12,
  completionTokens: 4,
  estimatedCostMicros: 90,
  createdAt: new Date('2026-10-06T00:00:00.000Z'),
};

describe('buildLlmCallReceipt', () => {
  it('keeps model, provider, key source, tokens, cost, user, and account', () => {
    const row = buildLlmCallReceipt(base);
    expect(row).toMatchObject({
      userId: 'user-1',
      accountId: 'acct-1',
      provider: 'openai',
      model: 'gpt-4o',
      keySource: 'byok',
      promptTokens: 12,
      completionTokens: 4,
      estimatedCostMicros: 90,
    });
    expect(row.createdAt).toEqual(base.createdAt);
  });

  it('does not copy prompt text, response text, or key material', () => {
    const polluted = {
      ...base,
      prompt: 'secret prompt text',
      response: 'secret response text',
      content: 'also secret',
      apiKey: 'sk-live-secret',
      encryptedKey: 'ciphertext',
      keyHint: 'ab12',
      messages: [{ role: 'user', content: 'hello' }],
    };
    const row = buildLlmCallReceipt(polluted);
    const encoded = JSON.stringify(row);
    expect(encoded).not.toContain('secret prompt text');
    expect(encoded).not.toContain('secret response text');
    expect(encoded).not.toContain('sk-live-secret');
    expect(encoded).not.toContain('ciphertext');
    expect(encoded).not.toContain('ab12');
    expect(row).not.toHaveProperty('prompt');
    expect(row).not.toHaveProperty('response');
    expect(row).not.toHaveProperty('apiKey');
    expect(row).not.toHaveProperty('encryptedKey');
    expect(row).not.toHaveProperty('messages');
  });
});
