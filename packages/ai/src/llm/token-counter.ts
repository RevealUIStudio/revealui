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

// Cost per 1M tokens (USD)  -  input/output pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25 },
  // OpenAI
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // Groq (Qwen  -  Apache 2.0)
  'qwen/qwen3-32b': { input: 0.59, output: 0.79 },
  // Ollama (self-hosted  -  no cost)
  'gemma4:e2b': { input: 0, output: 0 },
  'gemma4:e4b': { input: 0, output: 0 },
  'gemma4:26b': { input: 0, output: 0 },
  'nomic-embed-text': { input: 0, output: 0 },
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
