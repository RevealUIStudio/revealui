# Semantic Caching for LLM Responses

Up to **73% cost reduction** in published industry benchmarks (Redis blog, FAQ-style traffic) through meaning-based caching.

> **Note on benchmarks.** Every percentage and dollar figure in this guide is from Redis's published benchmarks and similar industry references — they are not measured RevealUI traffic (RevealUI is pre-launch with 0 paying customers). RevealUI ships the implementation; your real savings depend on your query distribution.

## Overview

Semantic caching uses **vector embeddings** to match similar queries, not just exact duplicates. This provides dramatically better hit rates than exact-match caching.

### Industry-benchmark performance (Redis)

- **~73% cost reduction** (vs ~20% for exact-match caching)
- **~65% cache hit rate** (vs ~18% for exact matches)
- **~96.9% latency reduction** on cache hits
- **~3.6× better hit rate** than exact matching

### How It Works

```typescript
// These all match the same cache entry! 🎯
"How do I reset my password?"     // Original query (cached)
"What's the process to reset my password?"  // ✅ Cache hit!
"Help me reset my password"       // ✅ Cache hit!
"Password reset help"             // ✅ Cache hit!
```

Traditional caching only matches the **first** query. Semantic caching matches **all four**.

## Comparison: Semantic vs Response vs Prompt Caching

| Feature | Semantic Cache | Response Cache | Prompt Cache |
|---------|---------------|----------------|--------------|
| **Savings** | 73% cost reduction | 100% on exact duplicates | 90% on cached tokens |
| **Hit Rate** | 65% typical | 18% typical | Varies |
| **Matching** | Similar meaning | Exact match | Exact prefix |
| **Providers** | All (requires pgvector) | All | Anthropic only |
| **Best For** | FAQ, similar queries | Duplicate requests | Repeated context |
| **Cache Key** | Vector similarity | SHA-256 hash | N/A (provider-side) |
| **Threshold** | 0.95 (configurable) | 1.0 (exact) | N/A |

### When to Use Each

**Use All Three Together** for maximum savings:
1. **Semantic Cache** - Catches similar questions (65% hit rate)
2. **Response Cache** - Catches exact duplicates that semantic missed
3. **Prompt Cache** - Saves on system prompts and tools (Anthropic only)

**Combined Impact**: 73% base savings + additional exact-match savings + 90% on prompts

## Quick Start

### 1. Enable Semantic Caching

```bash
# In your .env file
LLM_ENABLE_SEMANTIC_CACHE=true

# Required: PostgreSQL with pgvector extension
POSTGRES_URL=postgresql://user:password@host:port/database
```

### 2. Use in Code

Semantic caching is automatic once enabled:

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'

const client = createLLMClientFromEnv()

// First query - generates embedding, calls API, caches response
const response1 = await client.chat([
  { role: 'user', content: 'How do I reset my password?' }
])

// Similar query within 1 hour - instant cache hit! (no API call)
const response2 = await client.chat([
  { role: 'user', content: "What's the process to reset my password?" }
])

// Check cache stats
const stats = client.getSemanticCacheStats()
console.log(`Hit rate: ${stats?.hitRate}%`)
console.log(`Avg similarity: ${stats?.avgSimilarity}`)
```

That's it! No code changes needed.

## How It Works

### 1. Query Embedding

When a query comes in, we generate a vector embedding:

```typescript
const embedding = await generateEmbedding(userQuery)
// Returns: [0.123, -0.456, 0.789, ...] (768 dimensions with the default
// nomic-embed-text via Ollama; 1536 if you configure OpenAI's text-embedding-3-small)
```

### 2. Similarity Search

Search for cached responses with similar embeddings:

```typescript
const results = await vectorService.searchSimilar(embedding, {
  limit: 1,
  threshold: 0.95,  // 95% similarity required
  filters: {
    type: 'semantic_cache',
    userId: 'user-123',  // Multi-tenant support
    siteId: 'site-456',
  }
})
```

### 3. Cache Hit or Miss

**Cache Hit** (similarity ≥ 0.95):
- Return cached response immediately
- No API call, no cost
- 96.9% faster than API call

**Cache Miss** (similarity < 0.95):
- Call LLM API
- Store response with embedding
- Future similar queries will hit cache

### Cache Flow

```
User Query
   ↓
Generate Embedding (50ms)
   ↓
Search Similar Vectors (10ms)
   ↓
   ├─→ Cache Hit (≥95% similar)
   │      ↓
   │   Return Cached Response (60ms total)
   │
   └─→ Cache Miss (<95% similar)
          ↓
       Call LLM API (2000ms)
          ↓
       Store Response + Embedding
          ↓
       Return Response (2050ms total)
```

## Configuration

### Environment Variables

```bash
# Enable semantic caching
LLM_ENABLE_SEMANTIC_CACHE=true

# Alternative name
SEMANTIC_CACHE_ENABLED=true

# Required: PostgreSQL with pgvector
POSTGRES_URL=postgresql://user:password@host:port/database
```

### Programmatic Configuration

```typescript
import { LLMClient } from '@revealui/ai/llm/client'

const client = new LLMClient({
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY!,
  enableSemanticCache: true,
  semanticCacheOptions: {
    similarityThreshold: 0.95,  // 95% similarity required (default)
    ttl: 60 * 60 * 1000,        // 1 hour (default)
    enableStats: true,          // Track statistics (default)
    userId: 'user-123',         // Multi-tenant filtering
    siteId: 'site-456',         // Multi-tenant filtering
  },
})
```

### Cache Options

| Option | Default | Description |
|--------|---------|-------------|
| `similarityThreshold` | 0.95 | Minimum similarity for cache hit (0-1) |
| `ttl` | 3600000 (1hr) | Time to live in milliseconds |
| `enableStats` | true | Track hit/miss statistics |
| `userId` | 'global' | User ID for multi-tenant caching |
| `siteId` | 'global' | Site ID for multi-tenant caching |

## Similarity Threshold Guide

The similarity threshold determines how "similar" queries must be to match:

| Threshold | Hit Rate | Use Case | Example Matches |
|-----------|----------|----------|-----------------|
| **0.99** | Low (~30%) | Nearly identical only | "reset password" ↔ "reset my password" |
| **0.95** | Medium (~65%) | **Recommended default** | "How do I reset?" ↔ "Password reset help" |
| **0.90** | High (~80%) | More flexible | "reset password" ↔ "forgot password" |
| **0.85** | Very high (~90%) | Risky - may match unrelated | Not recommended |

**Recommendation**: Start with **0.95** and adjust based on your use case.

## Monitoring

### Check Cache Statistics

```typescript
const stats = client.getSemanticCacheStats()

if (stats) {
  console.log(`Hits: ${stats.hits}`)
  console.log(`Misses: ${stats.misses}`)
  console.log(`Hit Rate: ${stats.hitRate}%`)
  console.log(`Avg Similarity: ${stats.avgSimilarity}`)
  console.log(`Total Queries: ${stats.totalQueries}`)
}
```

### Calculate Cost Savings

```typescript
import { calculateSemanticCacheSavings } from '@revealui/ai/llm/semantic-cache'

const stats = client.getSemanticCacheStats()

if (stats) {
  const savings = calculateSemanticCacheSavings(stats, {
    avgTokensPerQuery: 3500,  // Your average query size
    costPerMTokens: 3.0,      // Groq/OpenAI pricing
  })

  console.log(`Queries avoided: ${savings.queriesAvoided}`)
  console.log(`Tokens avoided: ${savings.tokensAvoided.toLocaleString()}`)
  console.log(`Total saved: $${savings.totalSaved.toFixed(2)}`)
}
```

### API Response Logging

All API endpoints automatically log semantic cache stats:

```json
{
  "message": "Semantic cache stats",
  "hits": 13,
  "misses": 7,
  "hitRate": "65%",
  "avgSimilarity": 0.97,
  "totalQueries": 20
}
```

## Use Cases

### Use Case 1: Customer Support FAQ

Users ask similar questions in different ways:

```typescript
// All these match the same cache entry:
"How do I cancel my subscription?"
"What's the process to cancel?"
"Cancel my account please"
"I want to unsubscribe"
"How to stop my subscription?"

// Result: 73% cost reduction on FAQ queries
```

### Use Case 2: Multi-Language Support

Similar queries in different phrasings:

```typescript
// English variations
"What are your hours?" → "When are you open?"
"Contact support" → "How to reach customer service"
"Track my order" → "Where is my package?"

// All cache hits with 0.95 threshold
```

### Use Case 3: Development & Testing

Testing similar prompts during development:

```typescript
// Iteration 1: "Explain React hooks"
// Iteration 2: "What are React hooks?"
// Iteration 3: "How do React hooks work?"
// All hit cache - save on testing costs!
```

## Advanced Usage

### Cache Warming

Pre-populate cache with common queries:

```typescript
import { getGlobalSemanticCache } from '@revealui/ai/llm/semantic-cache'

const cache = getGlobalSemanticCache()

// Warm cache with FAQ on startup
await cache.warmCache([
  {
    query: 'How do I reset my password?',
    response: 'Go to Settings > Security > Reset Password...',
  },
  {
    query: 'What are your business hours?',
    response: 'We are open Monday-Friday, 9 AM - 5 PM EST...',
  },
  {
    query: 'How do I contact support?',
    response: 'You can reach support at support@example.com...',
  },
])

// Now all similar queries hit cache immediately!
```

### Multi-Tenant Caching

Isolate cache by user/site:

```typescript
const userCache = new SemanticCache({
  userId: 'user-123',
  siteId: 'site-456',
  similarityThreshold: 0.95,
})

// Only searches cache for this user/site
const response = await userCache.get('My query')
```

### Custom Similarity Threshold

Adjust threshold per use case:

```typescript
// Strict matching (financial/medical apps)
const strictCache = new SemanticCache({
  similarityThreshold: 0.98,  // 98% similarity required
})

// Flexible matching (general chat)
const flexibleCache = new SemanticCache({
  similarityThreshold: 0.90,  // 90% similarity OK
})
```

## Best Practices

### ✅ DO

1. **Use for FAQ-style applications** - Highest ROI
2. **Set appropriate threshold** - 0.95 is a good default
3. **Monitor hit rates** - Adjust threshold based on metrics
4. **Warm cache on startup** - Pre-populate common queries
5. **Use with other caching** - Combine with response + prompt caching
6. **Enable for all providers** - Works with Groq, OpenAI, Anthropic

### ❌ DON'T

1. **Don't use for highly unique queries** - Low hit rate
2. **Don't set threshold too low** - May return wrong responses
3. **Don't cache time-sensitive data** - "What time is it?"
4. **Don't cache user-specific data** - Unless using multi-tenant
5. **Don't rely on cache for correctness** - Cache may return similar but not identical response

## Troubleshooting

### Low Hit Rate?

**Possible causes:**
- Queries are genuinely unique (expected)
- Similarity threshold too high (try lowering to 0.90)
- TTL too short for request patterns (try 2-4 hours)

**Solutions:**
```typescript
// Lower threshold for more matches
semanticCacheOptions: {
  similarityThreshold: 0.90,  // Down from 0.95
  ttl: 2 * 60 * 60 * 1000,    // 2 hours instead of 1
}
```

### Cache Not Working?

1. **Check environment variable**:
   ```bash
   echo $LLM_ENABLE_SEMANTIC_CACHE  # Should be: true
   ```

2. **Check PostgreSQL connection**:
   ```bash
   echo $POSTGRES_URL  # Should be set
   ```

3. **Check pgvector extension**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

4. **Check stats**:
   ```typescript
   const stats = client.getSemanticCacheStats()
   if (!stats) {
     console.log('Semantic caching not enabled')
   }
   ```

### Wrong Responses Returned?

If cache returns incorrect responses, your threshold is **too low**:

```typescript
// Increase threshold for stricter matching
semanticCacheOptions: {
  similarityThreshold: 0.97,  // Up from 0.95
}
```

### Database Performance Issues?

Vector search is fast but can be optimized:

```sql
-- Add index for faster similarity search
CREATE INDEX idx_vector_embedding ON memories USING ivfflat (embedding vector_cosine_ops);

-- Add index for type filtering
CREATE INDEX idx_vector_type ON memories (type);
```

## Cost Analysis

### Estimating savings for your traffic

There is no universal "Semantic Caching ROI" number — savings depend entirely on your duplicate-and-similar rate, your provider's per-token cost, and your traffic volume. Build your own estimate from measured stats:

```ts
import { getGlobalSemanticCache } from '@revealui/ai/llm/semantic-cache'

const cache = getGlobalSemanticCache()
const stats = cache.getStats() // { hits, misses, hitRate, ... }

// providerCostPerCall = your blended cost per LLM call (USD)
// callsPerDay = your measured daily call volume
const dailySavings = stats.hitRate * callsPerDay * providerCostPerCall
const monthlySavings = dailySavings * 30
```

For published reference benchmarks, Redis reports up to ~65% hit rate / ~73% cost reduction on FAQ-style traffic. Treat those numbers as a ceiling, not a forecast.

### Comparison: cache-strategy stacking

Combine response, semantic, and (Anthropic-only) prompt caching when your traffic mix supports it:

- **Response cache** catches exact-duplicate requests cheaply (no embedding cost).
- **Semantic cache** catches similar requests at a low embedding cost per miss.
- **Prompt cache** (Anthropic only) discounts repeated input prefix tokens server-side.

Each layer has its own hit rate; treat them as additive on disjoint slices of your traffic, not multiplicative.

## Implementation Notes

### Database Requirements

Semantic caching requires PostgreSQL with pgvector extension:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memories table (created by migrations)
-- Default schema uses VECTOR(768) for nomic-embed-text via Ollama
-- (see packages/db/src/schema/rag.ts and packages/ai/src/embeddings/index.ts).
-- If you switch to OpenAI text-embedding-3-small, the column becomes VECTOR(1536).
```

### Embedding Generation

Default: Ollama's `nomic-embed-text` model — local, free, 768 dimensions. The default is set in `packages/ai/src/embeddings/index.ts`.

| Provider / Model | Dimensions | Cost | Speed |
|---|---|---|---|
| **Ollama / `nomic-embed-text` (default)** | **768** | Free (local) | Local-network fast |
| OpenAI / `text-embedding-3-small` (opt-in) | 1536 | ~$0.00002 / query | ~50ms |
| OpenAI / `text-embedding-3-large` (opt-in) | 3072 | ~$0.00013 / query | ~50ms |

### Storage Costs

**Per cached entry (default 768-dim)**:
- Embedding: 768 floats × 4 bytes = 3 KB
- Metadata: ~1-2 KB
- **Total**: ~5 KB per entry

**1000 cached entries** ≈ 5 MB storage (negligible). With 1536-dim OpenAI embeddings, double that.

## Summary

Semantic caching provides:
- Cost reduction on cache hits is 100% (no provider call). Real-world dollar savings depend on your duplicate-rate × hit-rate. Industry benchmarks (Redis blog, FAQ-style traffic) report ~65% hit rate / ~73% cost reduction; RevealUI ships the implementation, but those numbers are not measured RevealUI traffic.
- ✅ Faster responses on cache hits (no provider round-trip)
- ✅ Works with **all providers** (Groq, OpenAI, Anthropic)
- ✅ **Zero code changes** (environment variable only)
- ✅ **Multi-tenant support** for SaaS applications
- ✅ **Automatic cache management** (TTL-based expiration)

**Perfect for**:
- Customer support (FAQ-style queries)
- Chatbots (similar questions)
- Development/testing (iterative prompts)
- Multi-user applications (shared queries)

---

**Status**: Implementation has unit tests in `packages/ai/src/llm/__tests__/`. Production traffic baseline is not yet established (RevealUI is pre-launch).
**Provider**: All providers (requires pgvector)
**Deployment**: Set `LLM_ENABLE_SEMANTIC_CACHE=true`
