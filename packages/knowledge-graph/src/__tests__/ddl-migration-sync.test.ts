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

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', '..', 'db', 'migrations');

/**
 * The DDL builder describes the graph tables' FULL current shape as a
 * sequence of statements (PGlite tests build fresh tables straight from it);
 * production ships that same statement sequence across two migrations. 0021
 * created the tables; 0022 (GAP-349) appended the ALTER sequence that adds
 * `kg_nodes.search_text` and repoints the generated `search` column at it.
 * Concatenating both files is the migration-side mirror of the builder's
 * statement list.
 */
const MIGRATION_TAGS = ['0021_knowledge_graph', '0022_kg_search_text'];

describe('DDL / migration sync', () => {
  const migration = collapse(
    MIGRATION_TAGS.map((tag) => readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf-8')).join(
      '\n',
    ),
  );

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
