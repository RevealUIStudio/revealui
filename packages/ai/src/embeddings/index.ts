/**
 * Embedding Generation Utilities
 *
 * Functions for generating embeddings using the configured LLM provider.
 * Provider is auto-detected from env vars (OLLAMA_BASE_URL → GROQ → ANTHROPIC).
 * For local/free inference use Ollama with `nomic-embed-text`.
 * Note: Groq and Anthropic do not support embeddings — use Ollama for embedding tasks.
 */

import z from 'zod/v4';
import { createLLMClientFromEnv } from '../llm/client.js';

const EmbeddingSchema = z
  .object({
    /** The embedding model used */
    model: z.string(),

    /** The embedding vector */
    vector: z.array(z.number()),

    /** Dimension of the vector (for validation) */
    dimension: z.number().int().positive(),

    /** When this embedding was generated */
    generatedAt: z.string().datetime(),
  })
  .refine((data) => data.vector.length === data.dimension, {
    message: 'Embedding vector length must match specified dimension',
  });
type Embedding = z.infer<typeof EmbeddingSchema>;

export interface GenerateEmbeddingOptions {
  /**
   * Embedding model to use. Provider-specific:
   * - Ollama: 'nomic-embed-text' (default), 'mxbai-embed-large', etc.
   * - OpenAI: 'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'
   * If omitted, the provider uses its own default (Ollama → nomic-embed-text).
   */
  model?: string;
  cache?: boolean; // Whether to cache embeddings (future feature)
}

/**
 * Generate an embedding for the given text using the configured LLM provider.
 *
 * @param text - Text to generate embedding for
 * @param options - Options for embedding generation
 * @returns Embedding object with vector and metadata
 *
 * @example
 * ```typescript
 * // With Ollama (OLLAMA_BASE_URL set):
 * const embedding = await generateEmbedding('user prefers dark theme')
 * // Returns: { vector: number[], model: 'nomic-embed-text', dimension: 768, generatedAt: '...' }
 * ```
 */
export async function generateEmbedding(
  text: string,
  options: GenerateEmbeddingOptions = {},
): Promise<Embedding> {
  const { model } = options;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  // Use unified LLM client — auto-detects provider from env vars
  const client = createLLMClientFromEnv();

  // Ask client to embed — each provider uses its own default model when model is undefined
  const result = await client.embed(text, model ? { model } : undefined);

  // If provider returned batch, pick first
  const embeddingResult = Array.isArray(result) ? result[0] : result;

  if (!(embeddingResult && Array.isArray(embeddingResult.vector))) {
    throw new Error('Invalid embedding response from LLM provider');
  }

  const embedding: Embedding = {
    vector: embeddingResult.vector,
    model: String(embeddingResult.model || model),
    dimension: embeddingResult.dimension || embeddingResult.vector.length,
    generatedAt: new Date().toISOString(),
  };

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Options for embedding generation
 * @returns Array of embeddings in the same order as input texts
 */
export async function generateEmbeddings(
  texts: string[],
  options: GenerateEmbeddingOptions = {},
): Promise<Embedding[]> {
  // Generate in parallel — providers that support batch (Ollama, OpenAI) can be
  // optimised later by passing the full array directly to client.embed()
  const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text, options)));

  return embeddings;
}
