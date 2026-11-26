import { describe, expect, it, vi } from 'vitest';
import { embedTextForIndex, HOSTED_INDEX_EMBEDDING_REFUSAL } from '../indexer.js';

describe('embedTextForIndex', () => {
  it('fails closed on hosted and does not call the env embedding fallback', async () => {
    const generateEmbedding = vi.fn(async () => ({ vector: [1] }));

    await expect(
      embedTextForIndex('a post', generateEmbedding, { REVEALUI_DEPLOYMENT_MODE: 'hosted' }),
    ).rejects.toThrow(HOSTED_INDEX_EMBEDDING_REFUSAL);
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it('fails closed when hosted is detected from the license private key', async () => {
    const generateEmbedding = vi.fn(async () => ({ vector: [1] }));

    await expect(
      embedTextForIndex('a post', generateEmbedding, { REVEALUI_LICENSE_PRIVATE_KEY: 'present' }),
    ).rejects.toThrow(/deployment env model key/);
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it('embeds with the caller on forge', async () => {
    const generateEmbedding = vi.fn(async () => ({ vector: [4, 5] }));

    await expect(
      embedTextForIndex('a post', generateEmbedding, {
        REVEALUI_DEPLOYMENT_MODE: 'forge',
        OPENAI_API_KEY: 'present',
        OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
      }),
    ).resolves.toEqual([4, 5]);
    expect(generateEmbedding).toHaveBeenCalledWith('a post');
  });
});
