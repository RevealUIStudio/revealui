# Prompt Caching Quick Start 🚀

**Get 90% cost savings in 2 minutes!**

## Step 1: Enable Caching (Choose One)

### Option A: Environment Variable (Recommended)
```bash
# Add to your .env file
LLM_ENABLE_CACHE=true
```

### Option B: In Code
```typescript
const client = new LLMClient({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  enableCacheByDefault: true,
})
```

## Step 2: Mark Content for Caching

```typescript
import { cacheableSystemPrompt } from '@revealui/ai/llm/cache-utils'

const messages = [
  // System prompt gets cached automatically
  cacheableSystemPrompt('You are a helpful AI assistant...'),

  // User message (not cached)
  { role: 'user', content: 'Hello!' },
]

const response = await client.chat(messages, { enableCache: true })
```

## Step 3: See the Savings

```typescript
import { formatCacheStats } from '@revealui/ai/llm/cache-utils'

if (response.usage) {
  console.log(formatCacheStats(response.usage))
  // Output: "Cache: 45% read (2,500 tokens)"
}
```

## That's It! 🎉

Your first request creates the cache. The next request within 5 minutes gets a 90% discount on cached tokens!

## Common Patterns

### Pattern 1: Agent with Tools (Highest ROI)
```typescript
const runtime = new AgentRuntime({
  enableCache: true,  // ✅ Already enabled by default!
})

// Agent instructions and tools are automatically cached
await runtime.executeTask(agent, task, client)
```

### Pattern 2: Document Q&A
```typescript
import { createCachedConversation } from '@revealui/ai/llm/cache-utils'

const conversation = createCachedConversation({
  systemPrompt: 'You are a documentation assistant.',
  contextDocs: [largeDocumentation],  // Gets cached
  messages: [{ role: 'user', content: 'Your question?' }],
})

await client.chat(conversation, { enableCache: true })
```

### Pattern 3: Multi-Turn Chat
```typescript
import { withCache } from '@revealui/ai/llm/cache-utils'

// Cache conversation history for follow-ups
messages[messages.length - 1] = withCache(messages[messages.length - 1])
```

## Cost Savings Calculator

**Example: 1000 agent requests/day with 3000 cached tokens**

| Metric | Without Cache | With Cache | Savings |
|--------|--------------|-----------|---------|
| Monthly tokens | 90M | ~18M effective | 80% |
| Monthly cost | $270 | $67.50 | **$202.50** |

## Need More Details?

- 📖 **Full docs**: `docs/ai/PROMPT_CACHING.md`
- 💡 **Examples**: `packages/ai/examples/prompt-caching-example.ts`
- 🛠️ **Utilities**: `packages/ai/src/llm/cache-utils.ts`
- 📝 **Implementation**: `PROMPT_CACHING_IMPLEMENTATION.md`

## Key Rules

✅ **DO**:
- Cache system prompts (always repeat)
- Cache tool definitions (rarely change)
- Cache large documents (>1024 tokens)
- Make multiple requests within 5 minutes

❌ **DON'T**:
- Cache user queries (always different)
- Cache real-time data (changes constantly)
- Cache small content (<1024 tokens)

---

**Implemented**: 2025-02-04
**Status**: ✅ Production Ready
**Provider**: Anthropic Claude (OpenAI doesn't support caching yet)
