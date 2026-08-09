/**
 * Token Counter + Cost Estimator
 *
 * Heuristic-based (no tiktoken dep).
 * Anthropic/OpenAI/Groq: ~4 chars/token
 * Ollama: ~3.5 chars/token
 *
 * Limitation: actual token counts differ by model tokenizer. This is
 * accurate enough for budget tracking and context window management.
 */

import type { Message } from './providers/base.js';

export interface TokenCountResult {
  tokens: number;
  method: 'estimated';
}

export interface CostEstimate {
  estimatedCostUsd: number;
  tokens: number;
  model: string;
  direction: 'input' | 'output';
}

/**
 * Per-1M-token pricing (USD). Single source of truth for every cost path in the package:
 * `estimateCost` (input/output) and `calculateCacheCost` (cache-utils, cacheWrite/cacheRead).
 * Cache rates follow Anthropic's model (write ~125% of input, read ~10%); non-caching
 * providers carry 0 (local models are free; cache cost is not modelled for hosted
 * non-Anthropic providers here).
 */
export interface ModelPricing {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M tokens written to the prompt cache (0 where unsupported/unmodelled). */
  cacheWrite: number;
  /** USD per 1M tokens read from the prompt cache (0 where unsupported/unmodelled). */
  cacheRead: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic (current)
  'claude-opus-4-6': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25, cacheWrite: 0.3125, cacheRead: 0.025 },
  // Anthropic (legacy 2024  -  retained for cache-cost callers/examples)
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.5 },
  // OpenAI
  'gpt-4o': { input: 5.0, output: 15.0, cacheWrite: 0, cacheRead: 0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheWrite: 0, cacheRead: 0 },
  // Groq (Qwen  -  Apache 2.0)
  'qwen/qwen3-32b': { input: 0.59, output: 0.79, cacheWrite: 0, cacheRead: 0 },
  // Ollama (self-hosted  -  no cost)
  'qwen2.5:3b': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  'gemma4:e2b': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  'gemma4:e4b': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  'gemma4:26b': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  'nomic-embed-text': { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
};

function charsPerToken(model: string): number {
  const lower = model.toLowerCase();
  if (
    lower.includes('ollama') ||
    lower.includes('gemma') ||
    lower.includes('nomic') ||
    lower.includes('qwen')
  ) {
    return 3.5;
  }
  return 4.0;
}

/**
 * Estimate token count for a string.
 */
export function countTokens(text: string, options?: { model?: string }): TokenCountResult {
  const ratio = charsPerToken(options?.model ?? '');
  return { tokens: Math.ceil(text.length / ratio), method: 'estimated' };
}

/**
 * Estimate total token count for a messages array.
 * Adds 4 tokens per message for role/formatting overhead.
 */
export function countMessages(messages: Message[], options?: { model?: string }): TokenCountResult {
  let total = 0;
  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    total += countTokens(content, options).tokens + 4; // overhead per message
  }
  total += 2; // reply primer
  return { tokens: total, method: 'estimated' };
}

/**
 * Estimate cost in USD for a given token count, model, and direction.
 * Returns 0 for unknown models.
 */
export function estimateCost(
  tokens: number,
  model: string,
  direction: 'input' | 'output',
): CostEstimate {
  const pricing = MODEL_PRICING[model];
  const perMillion = pricing?.[direction] ?? 0;
  return {
    estimatedCostUsd: (tokens / 1_000_000) * perMillion,
    tokens,
    model,
    direction,
  };
}

/**
 * Estimate input token count and cost for a set of messages.
 * Convenience function for pre-flight cost checking.
 */
export function estimateRequest(
  messages: Message[],
  model: string,
): { tokens: number; estimatedCostUsd: number } {
  const { tokens } = countMessages(messages, { model });
  const { estimatedCostUsd } = estimateCost(tokens, model, 'input');
  return { tokens, estimatedCostUsd };
}
