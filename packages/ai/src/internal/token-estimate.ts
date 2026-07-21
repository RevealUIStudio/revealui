/**
 * Heuristic token estimate used across AI package internals.
 * ~4 characters per token (English-ish average). Not a model tokenizer.
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
