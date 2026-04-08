/**
 * Embeddings Integration Test
 *
 * Verifies real embedding generation works against a live provider.
 * Uses Ollama (localhost:11434) with nomic-embed-text when available.
 * OpenAI is intentionally NOT used.
 *
 * Run:
 *   pnpm --filter @revealui/ai test:integration
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve` + `ollama pull nomic-embed-text`
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateEmbedding, generateEmbeddings } from '../../embeddings/index.js';
import { LLMClient } from '../../llm/client.js';

const OLLAMA_BASE = 'http://localhost:11434';

async function isOllamaWithEmbeddingsAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/v1/models`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    type ModelsResponse = { data?: Array<{ id: string }> };
    const data = (await res.json()) as ModelsResponse;
    return (data.data ?? []).some((m) => m.id.startsWith('nomic-embed-text'));
  } catch {
    return false;
  }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

describe('Embeddings integration', async () => {
  const ollamaAvailable = await isOllamaWithEmbeddingsAvailable();

  describe.skipIf(!ollamaAvailable)('with Ollama nomic-embed-text', () => {
    beforeAll(() => {
      // Point createLLMClientFromEnv() at the local Ollama instance.
      // OLLAMA_BASE_URL must include /v1 — OllamaProvider uses it as-is as baseURL.
      vi.stubEnv('LLM_PROVIDER', 'ollama');
      vi.stubEnv('OLLAMA_BASE_URL', `${OLLAMA_BASE}/v1`);
    });

    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('generates a valid embedding for a single text', async () => {
      const embedding = await generateEmbedding('the quick brown fox jumps over the lazy dog');

      expect(embedding.vector).toBeInstanceOf(Array);
      expect(embedding.vector.length).toBeGreaterThan(0);
      expect(embedding.dimension).toBe(embedding.vector.length);
      expect(embedding.model).toBeTruthy();
      expect(embedding.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // nomic-embed-text produces 768-dimensional vectors
      expect(embedding.dimension).toBe(768);
    }, 15_000);

    it('generates embeddings for multiple texts in batch', async () => {
      const texts = ['hello world', 'goodbye world'];
      const embeddings = await generateEmbeddings(texts);

      expect(embeddings).toHaveLength(2);
      for (const emb of embeddings) {
        expect(emb.vector.length).toBe(emb.dimension);
        expect(emb.dimension).toBe(768);
      }
    }, 20_000);

    it('produces higher similarity for semantically related texts', async () => {
      const [catEmb, kittenEmb, airplaneEmb] = await Promise.all([
        generateEmbedding('a small domestic cat'),
        generateEmbedding('a young kitten playing'),
        generateEmbedding('a commercial passenger airplane'),
      ]);

      const catKittenSim = cosineSimilarity(catEmb.vector, kittenEmb.vector);
      const catAirplaneSim = cosineSimilarity(catEmb.vector, airplaneEmb.vector);

      // Cat ↔ kitten should be more similar than cat ↔ airplane
      expect(catKittenSim).toBeGreaterThan(catAirplaneSim);
      expect(catKittenSim).toBeGreaterThan(0);
      expect(catKittenSim).toBeLessThanOrEqual(1);
    }, 30_000);

    it('generates identical embeddings for identical inputs', async () => {
      const text = 'deterministic embedding test';
      const emb1 = await generateEmbedding(text);
      const emb2 = await generateEmbedding(text);

      // Ollama embeddings should be deterministic
      const similarity = cosineSimilarity(emb1.vector, emb2.vector);
      expect(similarity).toBeCloseTo(1, 5);
    }, 20_000);

    it('can embed via LLMClient directly with explicit model', async () => {
      const client = new LLMClient({
        provider: 'ollama',
        apiKey: 'ollama',
        baseURL: `${OLLAMA_BASE}/v1`,
      });

      const result = await client.embed('test direct embed', { model: 'nomic-embed-text' });
      const emb = Array.isArray(result) ? result[0] : result;

      expect(emb).toBeDefined();
      expect(emb?.vector.length).toBe(768);
      expect(emb?.model).toBe('nomic-embed-text');
    }, 15_000);
  });
});
