/**
 * Content Overflow Auto-Compressor
 *
 * Called when assembled context exceeds the token budget.
 * Uses the LLM to summarize, preserving key facts.
 */

import type { LLMClient } from '../llm/client.js';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compress context string if it exceeds maxTokens.
 * Returns the original context if it fits within budget.
 * Prepends "[summarized from N source chunks]" to compressed output.
 */
export async function compressContext(
  context: string,
  options: { maxTokens: number; llmClient: LLMClient },
): Promise<string> {
  if (estimateTokens(context) <= options.maxTokens) {
    return context;
  }

  // Count source chunks (numbered references like "[1] Source:")
  const chunkCount = (context.match(/^\[\d+\] Source:/gm) ?? []).length;

  try {
    const response = await options.llmClient.chat([
      {
        role: 'system',
        content:
          'Summarize the following context, preserving key facts, names, dates, and specific details. Be concise but complete.',
      },
      {
        role: 'user',
        content: context,
      },
    ]);

    const prefix = `[summarized from ${chunkCount} source chunks]\n\n`;
    return prefix + response.content;
  } catch {
    // On LLM failure, hard-truncate
    const maxChars = options.maxTokens * 4;
    return `${context.slice(0, maxChars)} [context truncated due to size]`;
  }
}
