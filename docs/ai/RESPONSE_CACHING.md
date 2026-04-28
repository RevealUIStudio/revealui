# Response Caching for All LLM Providers

Cache **complete LLM responses** at the application level — works with any provider. A cache HIT costs zero (no provider call); real-world dollar savings depend on your duplicate rate × hit rate.

> **Note on dollar figures.** Every dollar amount in this guide is illustrative arithmetic against assumed traffic patterns and assumed provider pricing — not measured RevealUI traffic (RevealUI is pre-launch with 0 paying customers). Use the calculator below to estimate against your own stats.

## Overview

Response caching complements Anthropic's prompt caching by caching **complete LLM responses** at the application level. This works with **any provider** (Groq, OpenAI, Anthropic, etc.); on a cache hit, no provider call is made (so the marginal cost is zero).

### Caching Comparison

| Feature | Anthropic Prompt Caching | Response Caching |
|---------|-------------------------|------------------|
| **Savings** | 90% on cached tokens | 100% on cached responses |
| **Providers** | Anthropic only | All providers |
| **Hit Condition** | Same prompt prefix | Exact match (messages + params) |
| **TTL** | 5 minutes | 5 minutes (configurable) |
| **Level** | Provider API | Application |
| **Best For** | Repeated context | Duplicate queries |

### When to Use Each

**Anthropic Prompt Caching** (provider-level):
- ✅ Use with Anthropic Claude
- ✅ Repeated system prompts
- ✅ Same tools across requests
- ✅ Partial message matches

**Response Caching** (application-level):
- ✅ Use with Groq, OpenAI, or any provider
- ✅ Exact duplicate questions
- ✅ FAQ-style interactions
- ✅ Testing/development

**Both Together** (maximum savings):
- ✅ Use when on Anthropic
- ✅ 90% savings on new requests (prompt cache)
- ✅ 100% savings on duplicates (response cache)
- ✅ Best of both worlds!

## Quick Start

### 1. Enable Response Caching

```bash
# In your .env file
LLM_ENABLE_RESPONSE_CACHE=true
```

###2. Use in Code

Response caching is automatic once enabled:

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'

const client = createLLMClientFromEnv()

// First request - calls API, caches response
const response1 = await client.chat(messages)

// Second identical request within 5 min - instant cache hit!
const response2 = await client.chat(messages)

// Check cache stats
const stats = client.getResponseCacheStats()
console.log(`Hit rate: ${stats?.hitRate}%`)
```

That's it! No code changes needed.

## Configuration

### Environment Variables

```bash
# Enable response caching (default: false)
LLM_ENABLE_RESPONSE_CACHE=true

# Or use alternative name
RESPONSE_CACHE_ENABLED=true
```

### Programmatic Configuration

```typescript
import { LLMClient } from '@revealui/ai/llm/client'

const client = new LLMClient({
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY!,
  enableResponseCache: true,
  responseCacheOptions: {
    max: 1000,           // Maximum cached responses
    ttl: 5 * 60 * 1000,  // 5 minutes (default)
    enableStats: true,   // Track hit/miss stats
  },
})
```

### Cache Options

| Option | Default | Description |
|--------|---------|-------------|
| `max` | 1000 | Maximum number of cached responses |
| `ttl` | 300000 (5min) | Time to live in milliseconds |
| `enableStats` | true | Track cache statistics |

## How It Works

### Cache Key Generation

The cache key is a SHA-256 hash of:
- Messages (role + content)
- Temperature
- Max tokens
- Tools
- Model name

```typescript
const key = cache.getCacheKey(messages, {
  temperature: 0.7,
  maxTokens: 1000,
  tools: [...],
  model: 'qwen2.5-72b-instruct',
})
```

**Same inputs** → Same key → Cache hit
**Different inputs** → Different key → Cache miss

### Cache Flow

```
Request → Generate Cache Key → Check Cache
                                     ↓
                               Cache Hit?
                            Yes ↙      ↘ No
                    Return Cached      Call LLM API
                                           ↓
                                    Store in Cache
                                           ↓
                                    Return Response
```

### LRU Eviction

When cache is full, **least recently used** entries are evicted:

```typescript
// Cache max size: 1000
// After 1000 unique requests...
// Request 1001 evicts the oldest (least recently accessed) entry
```

## Monitoring

### Check Cache Statistics

```typescript
const stats = client.getResponseCacheStats()

if (stats) {
  console.log(`Hits: ${stats.hits}`)
  console.log(`Misses: ${stats.misses}`)
  console.log(`Hit Rate: ${stats.hitRate}%`)
  console.log(`Cache Size: ${stats.size} / ${client.responseCache?.maxSize}`)
  console.log(`Evictions: ${stats.evictions}`)
}
```

### Calculate Cost Savings

```typescript
import { calculateResponseCacheSavings } from '@revealui/ai/llm/response-cache'

const stats = client.getResponseCacheStats()

if (stats) {
  const savings = calculateResponseCacheSavings(stats, {
    avgInputTokens: 3000,
    avgOutputTokens: 500,
    inputCostPerM: 3.0,   // Groq/OpenAI pricing
    outputCostPerM: 15.0,
  })

  console.log(`Requests avoided: ${savings.requestsAvoided}`)
  console.log(`Tokens avoided: ${savings.tokensAvoided.toLocaleString()}`)
  console.log(`Total saved: $${savings.totalSaved.toFixed(2)}`)
}
```

### API Response Logging

All API endpoints automatically log cache stats:

```json
{
  "message": "Response cache stats",
  "hits": 45,
  "misses": 55,
  "hitRate": "45%",
  "size": 78,
  "evictions": 2
}
```

## Use Cases

### Use Case 1: FAQ Bot

Users ask similar questions repeatedly:

```typescript
// User 1: "What are your hours?"
// → API call, cache response

// User 2: "What are your hours?" (within 5 min)
// → Cache hit! No API call, instant response

// User 3: "What are your hours?" (within 5 min)
// → Cache hit! Saves another API call
```

**Savings**: If 30% of questions are duplicates → 30% cost reduction

### Use Case 2: Development/Testing

Testing the same prompts during development:

```typescript
// Test run 1: "Explain TypeScript generics"
// → API call

// Test run 2: "Explain TypeScript generics"
// → Cache hit!

// Test runs 3-10: Same prompt
// → All cache hits!
```

**Savings**: 90% of test requests hit cache → massive cost reduction

### Use Case 3: Groq Production

Your current setup with Groq:

```typescript
// Request patterns in production:
// - 20% exact duplicates (FAQ, common queries)
// - 30% similar but not identical
// - 50% unique

// With response caching:
// - 20% = cache hits (100% savings)
// - 80% = cache misses (API calls)

// Overall cost reduction: 20%
```

**Monthly impact** (1000 req/day):
- Without cache: $270/month
- With cache: $216/month
- **Savings: $54/month**

## Advanced Usage

### Programmatic Cache Control

```typescript
import { getGlobalResponseCache } from '@revealui/ai/llm/response-cache'

// Get global cache instance
const cache = getGlobalResponseCache()

// Check if specific query is cached
const key = cache.getCacheKey(messages, options)
if (cache.has(key)) {
  console.log('This query is cached!')
}

// Manually clear cache
cache.clear()

// Get statistics
const stats = cache.getStats()
console.log(`Hit rate: ${stats.hitRate}%`)
```

### Cache Warming

Pre-populate cache with common queries:

```typescript
const commonQueries = [
  'What are your hours?',
  'How do I reset my password?',
  'Where is my order?',
]

// Warm cache on startup
for (const query of commonQueries) {
  await client.chat([{ role: 'user', content: query }])
}

// Now these queries will hit cache immediately
```

### Selective Caching

Cache only specific types of requests:

```typescript
async function chatWithSelectiveCache(
  messages: Message[],
  shouldCache: boolean,
) {
  // Create client with caching enabled/disabled per request
  const client = new LLMClient({
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY!,
    enableResponseCache: shouldCache,
  })

  return await client.chat(messages)
}

// Cache FAQ queries
await chatWithSelectiveCache(faqMessages, true)

// Don't cache personalized queries
await chatWithSelectiveCache(personalizedMessages, false)
```

## Best Practices

### ✅ DO

1. **Enable for Groq/OpenAI** - They don't have prompt caching
2. **Enable for development** - Massive savings during testing
3. **Use with Anthropic** - Get both prompt AND response caching
4. **Monitor hit rates** - Track effectiveness
5. **Adjust TTL** - Longer for FAQ, shorter for dynamic content

### ❌ DON'T

1. **Don't cache streaming** - Not supported (and wouldn't help)
2. **Don't cache user-specific** - Each user gets different responses
3. **Don't cache time-sensitive** - "What time is it?" needs fresh data
4. **Don't rely on long TTL** - 5 minutes is the sweet spot
5. **Don't cache everything** - Some queries benefit, some don't

## Troubleshooting

### Low Hit Rate?

**Possible causes:**
- Requests have slight variations (different temperature, etc.)
- TTL too short for request patterns
- Cache size too small (evictions happening)
- Queries are genuinely unique

**Solutions:**
```typescript
// Increase cache size
responseCacheOptions: {
  max: 5000,  // Up from 1000
}

// Increase TTL
responseCacheOptions: {
  ttl: 15 * 60 * 1000,  // 15 minutes
}

// Normalize requests (remove varying params)
const normalizedMessages = messages.map(m => ({
  role: m.role,
  content: m.content.trim().toLowerCase(),
}))
```

### Cache Not Working?

1. **Check environment variable**:
   ```bash
   echo $LLM_ENABLE_RESPONSE_CACHE  # Should be: true
   ```

2. **Check stats**:
   ```typescript
   const stats = client.getResponseCacheStats()
   if (!stats) {
     console.log('Response caching not enabled')
   }
   ```

3. **Check logs** for "Response cache stats" messages

### Memory Concerns?

Calculate memory usage:

```typescript
// Approximate memory per cached response: 2-5 KB
// 1000 cached responses ≈ 2-5 MB
// 10,000 cached responses ≈ 20-50 MB

// Adjust max size based on available memory:
responseCacheOptions: {
  max: process.env.NODE_ENV === 'production' ? 5000 : 1000,
}
```

## Integration Examples

### With Agent Runtime

```typescript
import { AgentRuntime } from '@revealui/ai/orchestration/runtime'
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'

const client = createLLMClientFromEnv()  // Caching enabled via env
const runtime = new AgentRuntime()

// Repeated agent tasks benefit from response caching
await runtime.executeTask(agent, task1, client)
await runtime.executeTask(agent, task2, client)  // May hit cache
```

### With admin Chat API

Already integrated! Just enable the environment variable:

```bash
LLM_ENABLE_RESPONSE_CACHE=true
```

Check logs for cache stats after each request.

## Estimating savings for your traffic

Response-cache savings = `hitRate × callsPerDay × providerCostPerCall`. Plug in your measured numbers:

```ts
import { getGlobalResponseCache } from '@revealui/ai/llm/response-cache'

const stats = getGlobalResponseCache().getStats() // { hits, misses, hitRate, ... }

// providerCostPerCall = your blended cost per LLM call (USD)
// callsPerDay = your measured daily call volume
const dailySavings = stats.hitRate * callsPerDay * providerCostPerCall
const monthlySavings = dailySavings * 30
```

Stacking response cache (any provider) with Anthropic prompt caching (when you use Anthropic) lets each layer hit a different slice of your traffic. Treat the layers as additive on disjoint slices, not multiplicative on the same call.

## Summary

Response caching provides:
- ✅ Cache hits skip the provider call entirely (marginal cost zero)
- ✅ Works with any provider (Groq, OpenAI, Anthropic, HuggingFace, Ollama, etc.)
- ✅ Zero code changes (environment variable only)
- ✅ Automatic cache management (LRU eviction)
- ✅ Built-in statistics and monitoring
- ✅ Configurable TTL and size
- ✅ Complements Anthropic prompt caching

**Best when**:
- A measurable fraction of your queries are exact duplicates (FAQ traffic, scripted health checks, dev/test loops)
- You're on a provider that doesn't ship prompt caching (Groq, OpenAI today)
- You're stacking with Anthropic prompt caching for a multi-layer hit profile

---

**Status**: Implementation has unit tests in `packages/ai/src/llm/__tests__/`. Production traffic baseline is not yet established (RevealUI is pre-launch).
**Provider**: All providers
**Deployment**: Set `LLM_ENABLE_RESPONSE_CACHE=true`
