/**
 * Tool Call Deduplicator
 *
 * Prevents redundant tool invocations within a single agent run.
 * Key: deterministic hash of (toolName, sorted params JSON).
 *
 * AnythingLLM lesson: without deduplication, an agent in a loop will
 * make the same web scrape or DB query dozens of times per response cycle.
 */

import type { ToolResult } from './base.js';

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  const record = obj as Record<string, unknown>;
  const sorted = Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = record[k];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

/**
 * Compute a stable cache key for a (toolName, params) pair.
 * Uses a simple djb2-style hash  -  no crypto dep required.
 */
function hashKey(toolName: string, params: unknown): string {
  const raw = `${toolName}::${stableStringify(params)}`;
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + (raw.charCodeAt(i) | 0)) >>> 0;
  }
  return hash.toString(16);
}

export class ToolCallDeduplicator {
  private cache: Map<string, ToolResult> = new Map();

  isDuplicate(toolName: string, params: unknown): boolean {
    return this.cache.has(hashKey(toolName, params));
  }

  getResult(toolName: string, params: unknown): ToolResult | undefined {
    return this.cache.get(hashKey(toolName, params));
  }

  record(toolName: string, params: unknown, result: ToolResult): void {
    this.cache.set(hashKey(toolName, params), result);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
