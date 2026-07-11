/**
 * Shared pgvector custom type.
 *
 * A single Drizzle `customType` for pgvector `vector(N)` columns, consumed by
 * every schema that stores embeddings (`rag.ts`, `agents.ts`,
 * `knowledge-graph.ts`). Previously this definition was duplicated verbatim in
 * `rag.ts` and `agents.ts` (with divergent default dimensions); it is extracted
 * here so all sites share one implementation.
 *
 * Embedding policy default is 768 dimensions (`nomic-embed-text` via Ollama);
 * pass `{ dimensions }` explicitly per column.
 */

import { customType } from 'drizzle-orm/pg-core';

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions?: number })?.dimensions ?? 768})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // PostgreSQL vector wire format is a bracketed list: [1,2,3]
    return JSON.parse(value) as number[];
  },
});
