import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KG_TABLES, kgDdlStatements } from '../db/ddl.js';

/** Collapse all ASCII whitespace runs to a single space (regex-free). */
function collapse(sql: string): string {
  const tokens: string[] = [];
  let cur = '';
  for (const ch of sql) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens.join(' ');
}

const MIGRATION_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'db',
  'migrations',
  '0021_knowledge_graph.sql',
);

describe('DDL / migration sync', () => {
  const migration = collapse(readFileSync(MIGRATION_PATH, 'utf-8'));

  it('the shipped migration contains every production (vector-variant) DDL statement', () => {
    // The migration is the single source's `vector` rendering; drift here means
    // the tables the package tests against no longer match what Neon receives.
    for (const statement of kgDdlStatements({ variant: 'vector' })) {
      expect(migration).toContain(collapse(statement));
    }
  });

  it('covers every kg_ table', () => {
    for (const table of KG_TABLES) {
      expect(migration).toContain(`"${table}"`);
    }
  });

  it('ships the vector + tsvector + partial-current indexes', () => {
    expect(migration).toContain('hnsw');
    expect(migration).toContain('vector_cosine_ops');
    expect(migration).toContain('GENERATED ALWAYS AS');
    expect(migration).toContain('gin');
    expect(migration).toContain('WHERE "invalid_at" IS NULL AND "expired_at" IS NULL');
  });
});
