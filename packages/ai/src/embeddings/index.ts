/**
 * Embedding Generation Utilities
 *
 * Functions for generating embeddings using OpenAI API.
 * Supports caching and various embedding models.
 */

import z from 'zod/v4'
import { createLLMClientFromEnv } from '../llm/client.js'

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
  })
type Embedding = z.infer<typeof EmbeddingSchema>

export interface GenerateEmbeddingOptions {
  model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
  cache?: boolean // Whether to cache embeddings (future feature)
}

const authorizationHeader = 'Authorization' as const

/**
 * Generate an embedding for the given text using OpenAI API.
 *
 * @param text - Text to generate embedding for
 * @param options - Options for embedding generation
 * @returns Embedding object with vector and metadata
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding('user prefers dark theme')
 * // Returns: { vector: number[], model: 'text-embedding-3-small', dimension: 1536, generatedAt: '...' }
 * ```
 */
export async function generateEmbedding(
  text: string,
  options: GenerateEmbeddingOptions = {},
): Promise<Embedding> {
  const { model = 'text-embedding-3-small' } = options

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string')
  }

  // Use unified LLM client which supports OpenAI, Vultr, etc.
  const client = createLLMClientFromEnv()

  // Ask client to embed — providers return a shape matching our Embedding type
  const result = await client.embed(text, { model })

  // If provider returned batch, pick first
  const embeddingResult = Array.isArray(result) ? result[0] : result

  if (!embeddingResult || !Array.isArray(embeddingResult.vector)) {
    throw new Error('Invalid embedding response from LLM provider')
  }

  const embedding: Embedding = {
    vector: embeddingResult.vector,
    model: String(embeddingResult.model || model),
    dimension: embeddingResult.dimension || embeddingResult.vector.length,
    generatedAt: new Date().toISOString(),
  }

  return embedding
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
  // OpenAI supports batch requests, but for simplicity we'll do them in parallel
  // In production, you might want to batch them into a single API call
  const embeddings = await Promise.all(texts.map((text) => generateEmbedding(text, options)))

  return embeddings
}
