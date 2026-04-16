# Anthropic Prompt Caching

Get up to **90% cost reduction** on repeated context using Anthropic's prompt caching feature.

## Quick Start

### 1. Enable Caching Globally

```bash
# In your .env file
LLM_ENABLE_CACHE=true
# or
ANTHROPIC_ENABLE_CACHE=true
```

### 2. Use in Code

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm/client'
import { cacheableSystemPrompt } from '@revealui/ai/llm/cache-utils'

const client = createLLMClientFromEnv()

// System prompt will be cached automatically
const messages = [
  cacheableSystemPrompt('You are a helpful AI assistant with expertise in TypeScript.'),
  { role: 'user', content: 'What is a Promise?' },
]

const response = await client.chat(messages, { enableCache: true })

// Check cache usage
if (response.usage?.cacheReadTokens) {
  console.log(`Cache hit! Saved ${response.usage.cacheReadTokens} tokens`)
}
```

## How It Works

### Cache Behavior

- **TTL**: 5 minutes
- **Minimum**: ~1024 tokens (~300 words) for optimal benefit
- **Discount**:
  - 90% off on cache hits (read)
  - 25% markup on cache creation (write)
- **Scope**: Per API key, not shared across accounts

### What Gets Cached

Mark content for caching using `cacheControl`:

```typescript
const message: Message = {
  role: 'system',
  content: 'Long system prompt...',
  cacheControl: { type: 'ephemeral' },
}
```

**Best candidates for caching:**
- System prompts with agent instructions
- Tool/function definitions
- Large context documents (docs, code, data)
- Conversation history (for multi-turn chats)

## Usage Patterns

### Pattern 1: Agent with Tools (Highest ROI)

```typescript
import { AgentRuntime } from '@revealui/ai/orchestration/runtime'
import { cacheableSystemPrompt } from '@revealui/ai/llm/cache-utils'

const agent = {
  id: 'code-assistant',
  name: 'Code Assistant',
  instructions: `You are an expert TypeScript developer.
You have access to tools for reading files, searching code, and running tests.
Always provide detailed explanations and follow best practices.`,
  tools: [
    // 10+ tool definitions here
    readFileTool,
    searchCodeTool,
    runTestsTool,
    // ...
  ],
}

const runtime = new AgentRuntime()

// Tools and instructions are automatically cached when enableCache is true
const result = await runtime.executeTask(agent, task, client)

// First call: Creates cache (~3000 tokens cached)
// Subsequent calls within 5min: 90% discount on those 3000 tokens!
```

**Cost savings**: If your system prompt + tools = 3000 tokens, and you make 20 requests in 5 minutes:
- **Without caching**: 60,000 tokens * $3/M = $0.18
- **With caching**: 3,000 + (20 * 300) = 9,000 tokens * $0.3/M = $0.0027
- **Savings**: ~$0.177 (98% reduction!)

### Pattern 2: Document Q&A

```typescript
import { createCachedConversation } from '@revealui/ai/llm/cache-utils'

const documentation = await fs.readFile('docs/api-reference.md', 'utf-8')
// Large doc: ~50,000 tokens

const conversation = createCachedConversation({
  systemPrompt: 'You are a documentation assistant.',
  contextDocs: [documentation], // Will be cached
  messages: [
    { role: 'user', content: 'How do I authenticate?' },
  ],
})

const response = await client.chat(conversation, { enableCache: true })

// Ask more questions within 5 minutes - documentation stays cached!
conversation.push({ role: 'assistant', content: response.content })
conversation.push({ role: 'user', content: 'What about rate limits?' })

const response2 = await client.chat(conversation, { enableCache: true })
// Cache hit! Saved ~50,000 tokens * 90% = ~$0.135 for Sonnet
```

### Pattern 3: Multi-Turn Conversation

```typescript
import { withCache } from '@revealui/ai/llm/cache-utils'

const messages: Message[] = [
  cacheableSystemPrompt('You are a helpful assistant.'),
]

// User asks first question
messages.push({ role: 'user', content: 'Tell me about TypeScript' })
let response = await client.chat(messages, { enableCache: true })
messages.push({ role: 'assistant', content: response.content })

// Cache the conversation history for follow-up questions
messages[messages.length - 1] = withCache(messages[messages.length - 1])

// Follow-up question - conversation history is cached
messages.push({ role: 'user', content: 'What about generics?' })
response = await client.chat(messages, { enableCache: true })

// Cache hit on previous conversation!
```

### Pattern 4: Skills/Resources

```typescript
import { globalSkillRegistry } from '@revealui/ai/skills/registry'

const skill = await globalSkillRegistry.loadSkill('typescript-expert')

// Skill instructions + resources (~5000 tokens)
const messages = [
  cacheableSystemPrompt(skill.instructions),
  ...skill.resources.map((r) => ({
    role: 'system' as const,
    content: r.content,
    cacheControl: { type: 'ephemeral' as const },
  })),
  { role: 'user', content: 'Help me optimize this code' },
]

const response = await client.chat(messages, { enableCache: true })
```

## Monitoring Cache Performance

### Check Cache Statistics

```typescript
import { formatCacheStats } from '@revealui/ai/llm/cache-utils'

const response = await client.chat(messages, { enableCache: true })

if (response.usage) {
  const stats = formatCacheStats(response.usage)
  if (stats) {
    console.log(stats)
    // Output: "Cache: 45% read (2,500 tokens), 10% created (500 tokens)"
  }
}
```

### Calculate Actual Costs

```typescript
import { calculateCacheCost } from '@revealui/ai/llm/cache-utils'

const cost = calculateCacheCost({
  model: 'claude-3-5-sonnet-20241022',
  promptTokens: 10000,
  completionTokens: 500,
  cacheCreationTokens: 3000,
  cacheReadTokens: 5000,
})

console.log(`Total cost: $${cost.total.toFixed(4)}`)
console.log(`Savings: $${cost.savings.toFixed(4)}`)
console.log('Breakdown:', cost.breakdown)
```

### Estimate Potential Savings

```typescript
import { estimateCacheSavings } from '@revealui/ai/llm/cache-utils'

// Scenario: 10K tokens input, 60% cache hit rate, 80% of input is cacheable
const savings = estimateCacheSavings(10000, 0.6, 0.8)
console.log(`Estimated savings: ${savings.toFixed(1)}%`) // ~43.2%
```

## Best Practices

### ✅ DO

1. **Cache stable content first**
   - System prompts (rarely change)
   - Tool definitions (rarely change)
   - Reference docs (rarely change)

2. **Order by stability**
   ```typescript
   [
     cacheableSystemPrompt(systemInstructions),  // Most stable
     withCache(toolDefinitions),                 // Very stable
     withCache(documentationContext),            // Stable
     ...conversationHistory,                     // Changes
     { role: 'user', content: 'new question' }  // Always new
   ]
   ```

3. **Cache at message boundaries**
   - Don't cache in the middle of a message
   - Cache complete logical units

4. **Use with high-volume workflows**
   - Agents with many tool calls
   - Document Q&A systems
   - Multi-turn conversations
   - Repeated queries on same data

5. **Monitor cache metrics**
   - Track hit rates
   - Measure cost savings
   - Adjust caching strategy

### ❌ DON'T

1. **Don't cache frequently changing content**
   - User queries (always different)
   - Real-time data (changes constantly)
   - Personalized content (per-user)

2. **Don't cache small content (<1024 tokens)**
   - Cache overhead > savings
   - Not worth the complexity

3. **Don't rely on cache duration**
   - 5-minute TTL is not guaranteed
   - Could be evicted earlier
   - Design for cache misses

4. **Don't cache sensitive data you want deleted**
   - Caches persist for 5 minutes
   - Cannot be manually cleared
   - Use for non-sensitive content

## Configuration Options

### Environment Variables

```bash
# Enable caching by default for all requests
LLM_ENABLE_CACHE=true

# Provider-specific (takes precedence)
ANTHROPIC_ENABLE_CACHE=true
```

### Per-Request Control

```typescript
// Override default - enable for this request
await client.chat(messages, { enableCache: true })

// Override default - disable for this request
await client.chat(messages, { enableCache: false })
```

### Provider Configuration

```typescript
import { LLMClient } from '@revealui/ai/llm/client'

const client = new LLMClient({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  enableCacheByDefault: true, // All requests use caching by default
})
```

## Pricing Comparison

**Claude 3.5 Sonnet** (per million tokens):
- Input: $3.00
- Cache Write: $3.75 (+25%)
- Cache Read: $0.30 (-90%)
- Output: $15.00

**Example: 20 requests with 5000 token system prompt**

| Scenario | Input Tokens | Cost | Savings |
|----------|--------------|------|---------|
| No caching | 100,000 | $0.30 | - |
| With caching (90% hit rate) | 23,750 effective | $0.07 | 77% |

**ROI Calculation**:
```typescript
// First request: 5000 tokens @ $3.75/M = $0.01875 (cache write)
// Next 19 requests: 19 * 5000 * 0.1 = 9,500 tokens @ $0.30/M = $0.00285
// Total: $0.0216
// vs No cache: 20 * 5000 = 100,000 @ $3/M = $0.30
// Savings: $0.2784 (92.8%)
```

## Architecture Integration

### In Agent Runtime

The `AgentRuntime` automatically marks system prompts and tools for caching when `enableCache: true`:

```typescript
// packages/ai/src/orchestration/runtime.ts
const messages: Message[] = [
  {
    role: 'system',
    content: agent.instructions,
    cacheControl: enableCache ? { type: 'ephemeral' } : undefined,
  },
  {
    role: 'user',
    content: task.description,
  },
]

const response = await llmClient.chat(messages, {
  tools: agent.tools, // Also cached automatically
  enableCache,
})
```

### In Memory System

Episodic memory can cache retrieved context:

```typescript
// Retrieve relevant memories
const memories = await episodicMemory.search('TypeScript patterns', {
  threshold: 0.7,
  limit: 10,
})

// Cache as context
const contextMessage: Message = {
  role: 'system',
  content: memories.map((m) => m.content).join('\n\n'),
  cacheControl: { type: 'ephemeral' },
}
```

## Troubleshooting

### Cache Not Working?

1. **Check API version**: Must be `2024-07-15` or later
   ```typescript
   // Automatically set when enableCache: true
   ```

2. **Check content size**: Need >1024 tokens
   ```typescript
   import { shouldCache } from '@revealui/ai/llm/cache-utils'

   if (!shouldCache(content)) {
     console.log('Content too small for caching')
   }
   ```

3. **Check response usage**: Look for cache tokens
   ```typescript
   if (!response.usage?.cacheReadTokens && !response.usage?.cacheCreationTokens) {
     console.log('No cache activity - check configuration')
   }
   ```

### Low Hit Rate?

1. **Content changing too frequently**: Cache only stable content
2. **TTL expired**: 5-minute window between requests
3. **Request rate too low**: Need multiple requests within 5 minutes
4. **Message order changed**: Cache keys are position-sensitive

## Migration Guide

### Updating Existing Code

**Before**:
```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userQuery },
]

const response = await client.chat(messages)
```

**After**:
```typescript
import { cacheableSystemPrompt } from '@revealui/ai/llm/cache-utils'

const messages = [
  cacheableSystemPrompt(systemPrompt),
  { role: 'user', content: userQuery },
]

const response = await client.chat(messages, { enableCache: true })
```

That's it! No other changes needed.

## References

- [Anthropic Prompt Caching Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [API Reference](https://docs.anthropic.com/en/api/messages)
- [Pricing](https://www.anthropic.com/pricing)
