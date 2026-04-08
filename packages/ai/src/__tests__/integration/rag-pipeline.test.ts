/**
 * RAG Pipeline Integration Test
 *
 * Tests the full ingestion + retrieval pipeline against a local Ollama instance.
 * Requires:
 *   - Ollama running: `ollama serve`
 *   - nomic-embed-text pulled: `ollama pull nomic-embed-text`
 *   - DATABASE_URL pointing to a Supabase/PostgreSQL instance with pgvector
 *
 * Run: pnpm --filter @revealui/ai test:integration
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const OLLAMA_BASE = 'http://localhost:11434';

async function isOllamaAvailable(): Promise<boolean> {
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

async function hasDatabaseUrl(): Promise<boolean> {
  return !!process.env.DATABASE_URL;
}

describe('RAG Pipeline integration', async () => {
  const ollamaAvailable = await isOllamaAvailable();
  const dbAvailable = await hasDatabaseUrl();
  const canRun = ollamaAvailable && dbAvailable;

  describe.skipIf(!ollamaAvailable)(
    'Text splitting + embedding (unit-level with real embeddings)',
    () => {
      beforeAll(() => {
        vi.stubEnv('LLM_PROVIDER', 'ollama');
        vi.stubEnv('OLLAMA_BASE_URL', `${OLLAMA_BASE}/v1`);
      });

      afterAll(() => {
        vi.unstubAllEnvs();
      });

      it('produces 768-dim embeddings for chunk content', async () => {
        const { generateEmbedding } = await import('../../embeddings/index.js');
        const { RecursiveCharacterSplitter } = await import('../../ingestion/text-splitter.js');

        const text = `
        RevealUI is an open-source business infrastructure platform.
        It provides users, content, products, payments, and AI capabilities.
        The platform is built on React 19, Next.js, and TypeScript.
      `.trim();

        const splitter = new RecursiveCharacterSplitter({ chunkSize: 100, overlap: 10 });
        const chunks = splitter.split(text);
        expect(chunks.length).toBeGreaterThan(0);

        const embedding = await generateEmbedding(chunks[0]!.content);
        expect(embedding.vector.length).toBe(768);
        expect(embedding.dimension).toBe(768);
      }, 30_000);
    },
  );

  describe.skipIf(!canRun)('Full pipeline (requires DATABASE_URL + Ollama)', () => {
    // biome-ignore lint/suspicious/noDuplicateTestHooks: sibling describe blocks each need their own setup
    beforeAll(() => {
      vi.stubEnv('LLM_PROVIDER', 'ollama');
      vi.stubEnv('OLLAMA_BASE_URL', `${OLLAMA_BASE}/v1`);
    });

    // biome-ignore lint/suspicious/noDuplicateTestHooks: sibling describe blocks each need their own teardown
    afterAll(() => {
      vi.unstubAllEnvs();
    });

    it('ingests a document and retrieves it via vector search', async () => {
      const { getVectorClient } = await import('@revealui/db/client');
      const { generateEmbedding } = await import('../../embeddings/index.js');
      const { IngestionPipeline } = await import('../../ingestion/pipeline.js');
      const { RagVectorService } = await import('../../ingestion/rag-vector-service.js');

      const { getRestClient } = await import('@revealui/db/client');
      const vectorDb = getVectorClient();
      const restDb = getRestClient();
      const embeddingFn = async (text: string): Promise<number[]> => {
        const emb = await generateEmbedding(text);
        return emb.vector;
      };

      const pipeline = new IngestionPipeline(vectorDb, restDb, embeddingFn);
      const workspaceId = `test-ws-${Date.now()}`;

      // Ingest a test document
      const result = await pipeline.ingest({
        workspaceId,
        sourceType: 'text',
        title: 'RevealUI Overview',
        rawContent:
          'RevealUI provides authentication, content management, payments via Stripe, and AI agents. It is open source under MIT license.',
        mimeType: 'text/plain',
      });

      expect(result.status).toBe('indexed');
      expect(result.chunkCount).toBeGreaterThan(0);

      // Search for it
      const service = new RagVectorService();
      const queryEmb = await generateEmbedding('What does RevealUI provide?');
      const results = await service.searchSimilar(queryEmb.vector, {
        workspaceId,
        limit: 5,
        threshold: 0.3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.chunk.content).toContain('RevealUI');
      expect(results[0]?.similarity).toBeGreaterThan(0.3);

      // Cleanup
      await pipeline.deleteDocument(result.documentId);
    }, 60_000);
  });
});
