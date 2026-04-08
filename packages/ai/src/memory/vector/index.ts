/**
 * Vector Search implementations
 *
 * Semantic search capabilities using pgvector:
 * - Embedding generation (OpenAI, local models)
 * - Similarity search
 * - Hybrid search (vector + metadata)
 *
 * @packageDocumentation
 */

export {
  VectorMemoryService,
  type VectorSearchOptions,
  type VectorSearchResult,
} from './vector-memory-service.js';

// Vector implementations will be added here
// export { generateEmbedding, type EmbeddingOptions } from './embeddings.js'
// export { semanticSearch, hybridSearch, type SearchOptions } from './search.js'
