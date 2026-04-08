import { describe, expect, it, vi } from 'vitest';
import { compressContext } from '../overflow-compressor.js';

describe('overflow compressor', () => {
  it('returns the original context when it fits within the token budget', async () => {
    const llmClient = {
      chat: vi.fn(),
    };

    await expect(
      compressContext('short context', {
        maxTokens: 100,
        llmClient: llmClient as never,
      }),
    ).resolves.toBe('short context');
    expect(llmClient.chat).not.toHaveBeenCalled();
  });

  it('summarizes oversized context and prefixes the source chunk count', async () => {
    const llmClient = {
      chat: vi.fn().mockResolvedValue({
        content: 'Condensed summary',
      }),
    };
    const context = '[1] Source: Alpha\nImportant details\n[2] Source: Beta\nMore details';
    const oversizedContext = Array.from({ length: 20 }, () => context).join('\n');

    await expect(
      compressContext(oversizedContext, {
        maxTokens: 20,
        llmClient: llmClient as never,
      }),
    ).resolves.toBe('[summarized from 40 source chunks]\n\nCondensed summary');
    expect(llmClient.chat).toHaveBeenCalledOnce();
  });

  it('truncates the context when summarization fails', async () => {
    const llmClient = {
      chat: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    };
    const context = '0123456789'.repeat(20);

    const result = await compressContext(context, {
      maxTokens: 10,
      llmClient: llmClient as never,
    });

    expect(result).toBe(`${context.slice(0, 40)} [context truncated due to size]`);
  });
});
