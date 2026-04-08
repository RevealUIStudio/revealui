/* console-allowed */

/**
 * Prompt Caching Utilities
 *
 * Helper functions for optimizing Anthropic prompt caching usage.
 * Cache hits provide up to 90% cost reduction on input tokens.
 *
 * Cache TTL: 5 minutes
 * Minimum cacheable content: ~1024 tokens (~300 words)
 *
 * Best practices:
 * - Cache stable content that repeats across requests
 * - Place cached content at message boundaries
 * - Cache system prompts, tools, and large context documents
 * - Order matters: place most stable content first
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

import type { Message } from './providers/base.js';

/**
 * Mark a message for caching
 * Use this for system prompts, tool definitions, or large context that repeats
 */
export function withCache(message: Message): Message {
  return {
    ...message,
    cacheControl: { type: 'ephemeral' },
  };
}

/**
 * Create a cacheable system prompt message
 *
 * @example
 * ```ts
 * const systemPrompt = cacheableSystemPrompt(
 *   'You are a helpful AI assistant with expertise in TypeScript and React.'
 * )
 * ```
 */
export function cacheableSystemPrompt(content: string): Message {
  return withCache({
    role: 'system',
    content,
  });
}

/**
 * Calculate potential cost savings from caching
 *
 * @param inputTokens - Total input tokens
 * @param cacheHitRate - Percentage of requests that hit cache (0-1)
 * @param cachedTokenPercentage - Percentage of input that's cached (0-1)
 * @returns Estimated cost reduction percentage
 *
 * @example
 * ```ts
 * // If 50% of requests hit cache and 70% of input is cached content
 * const savings = estimateCacheSavings(10000, 0.5, 0.7)
 * console.log(`${savings}% cost reduction`) // ~31.5%
 * ```
 */
export function estimateCacheSavings(
  inputTokens: number,
  cacheHitRate: number,
  cachedTokenPercentage: number,
): number {
  const cachedTokens = inputTokens * cachedTokenPercentage;
  const uncachedTokens = inputTokens - cachedTokens;

  // Cache creation cost: full price
  const firstRequestCost = inputTokens;

  // Cache hit cost: 10% for cached tokens + full price for uncached
  const cachedRequestCost = cachedTokens * 0.1 + uncachedTokens;

  // Average cost considering hit rate
  const avgCost = firstRequestCost * (1 - cacheHitRate) + cachedRequestCost * cacheHitRate;

  // Savings percentage
  return ((inputTokens - avgCost) / inputTokens) * 100;
}

/**
 * Format cache statistics from response
 *
 * @example
 * ```ts
 * const response = await client.chat(messages, { enableCache: true })
 * const stats = formatCacheStats(response.usage)
 * console.log(stats)
 * // "Cache: 45% read (2,500 tokens), 10% created (500 tokens)"
 * ```
 */
export function formatCacheStats(usage: {
  promptTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): string | null {
  const { promptTokens, cacheCreationTokens = 0, cacheReadTokens = 0 } = usage;

  if (cacheCreationTokens === 0 && cacheReadTokens === 0) {
    return null;
  }

  const readPct = ((cacheReadTokens / promptTokens) * 100).toFixed(0);
  const createdPct = ((cacheCreationTokens / promptTokens) * 100).toFixed(0);

  const parts: string[] = [];

  if (cacheReadTokens > 0) {
    parts.push(`${readPct}% read (${cacheReadTokens.toLocaleString()} tokens)`);
  }

  if (cacheCreationTokens > 0) {
    parts.push(`${createdPct}% created (${cacheCreationTokens.toLocaleString()} tokens)`);
  }

  return `Cache: ${parts.join(', ')}`;
}

/**
 * Check if caching is beneficial for the given content
 * Anthropic recommends caching content >1024 tokens
 */
export function shouldCache(content: string, minTokens = 1024): boolean {
  // Rough estimation: ~4 chars per token
  const estimatedTokens = content.length / 4;
  return estimatedTokens >= minTokens;
}

/**
 * Create a conversation with optimal caching structure
 *
 * @example
 * ```ts
 * const conversation = createCachedConversation({
 *   systemPrompt: 'You are a helpful assistant...',
 *   tools: [...], // Large tool definitions
 *   contextDocs: ['# Documentation\n...'], // Large context documents
 *   messages: [
 *     { role: 'user', content: 'What is TypeScript?' },
 *   ],
 * })
 *
 * const response = await client.chat(conversation, { enableCache: true })
 * ```
 */
export function createCachedConversation(config: {
  systemPrompt?: string;
  contextDocs?: string[];
  messages: Message[];
}): Message[] {
  const result: Message[] = [];

  // System prompt (always cached if present)
  if (config.systemPrompt) {
    result.push(cacheableSystemPrompt(config.systemPrompt));
  }

  // Context documents as system messages (cache last one)
  if (config.contextDocs && config.contextDocs.length > 0) {
    config.contextDocs.forEach((doc, index) => {
      const isLast = index === (config.contextDocs?.length ?? 0) - 1;
      result.push({
        role: 'system',
        content: doc,
        ...(isLast ? { cacheControl: { type: 'ephemeral' } } : {}),
      });
    });
  }

  // User/assistant messages (not cached by default)
  result.push(...config.messages);

  return result;
}

/**
 * Pricing information for Anthropic Claude models (as of 2024)
 * Prices are per million tokens
 */
export const ANTHROPIC_PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75, // 25% markup for cache creation
    cacheRead: 0.3, // 90% discount for cache hits
  },
  'claude-3-5-haiku-20241022': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
} as const;

/**
 * Calculate actual cost of a request with caching
 *
 * @example
 * ```ts
 * const cost = calculateCacheCost({
 *   model: 'claude-3-5-sonnet-20241022',
 *   promptTokens: 10000,
 *   completionTokens: 500,
 *   cacheCreationTokens: 3000,
 *   cacheReadTokens: 5000,
 * })
 *
 * console.log(`Request cost: $${cost.toFixed(4)}`)
 * console.log(`Savings vs no cache: $${cost.savings.toFixed(4)}`)
 * ```
 */
export function calculateCacheCost(usage: {
  model: keyof typeof ANTHROPIC_PRICING;
  promptTokens: number;
  completionTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}): { total: number; breakdown: Record<string, number>; savings: number } {
  const pricing = ANTHROPIC_PRICING[usage.model];
  const uncachedTokens =
    usage.promptTokens - (usage.cacheCreationTokens || 0) - (usage.cacheReadTokens || 0);

  const costs = {
    input: (uncachedTokens / 1_000_000) * pricing.input,
    output: (usage.completionTokens / 1_000_000) * pricing.output,
    cacheWrite: ((usage.cacheCreationTokens || 0) / 1_000_000) * pricing.cacheWrite,
    cacheRead: ((usage.cacheReadTokens || 0) / 1_000_000) * pricing.cacheRead,
  };

  const total = costs.input + costs.output + costs.cacheWrite + costs.cacheRead;

  // Calculate savings vs no caching
  const noCacheCost =
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output;

  return {
    total,
    breakdown: costs,
    savings: noCacheCost - total,
  };
}
