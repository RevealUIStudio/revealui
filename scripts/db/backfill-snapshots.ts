/**
 * GAP-166 backfill — generate Drizzle snapshots for migrations 0002-0005
 * by deriving from the existing 0006_snapshot.json, which already captures
 * the post-0005 Drizzle schema state per the audit at
 * docs/gap-specs/GAP-166-execution.md.
 *
 * Why this works (per audit):
 *   - 0006 was generated when the TS schema already had the post-0005
 *     deltas (shared_facts, yjs_document_patches, agent_memories scope
 *     columns/check/indexes) but BEFORE users.must_rotate_password was
 *     added. So 0006's CONTENT is effectively what 0005's snapshot
 *     should be.
 *   - The 0002 SQL only adds tsvector columns + triggers + HNSW indexes
 *     (none expressible in Drizzle TS), so 0002's snapshot is identical
 *     in Drizzle terms to 0001's — modulo metadata.
 *
 * Derivation:
 *   - 0005 ← clone(0006), new id, prevId = new 0004 id
 *   - 0004 ← clone(0005) minus agent_memories scope deltas
 *   - 0003 ← clone(0004) minus yjs_document_patches table
 *   - 0002 ← clone(0003) minus shared_facts table  (= 0001 content)
 *   - 0006 ← (mutate prevId) from 0001.id → new 0005.id
 *
 * Resulting chain:
 *   0000 → 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0009 → 0012 → 0013
 *   (previously skipped 0002-0005)
 *
 * Acceptance: `drizzle-kit generate` reports "No schema changes" against
 * the current TS schema after this runs; `pnpm --filter @revealui/db test`
 * stays green; full migration replay against PGlite applies cleanly.
 *
 * Usage:
 *   cd ~/revfleet/revealui
 *   pnpm tsx scripts/db/backfill-snapshots.ts
 *
 * Idempotent only in result-set sense: re-running mints fresh UUIDs and
 * rewires the chain again. The 0006_snapshot.json prevId rewire is the
 * only mutation to a tracked-by-other-migrations file.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const META_DIR = resolve(here, '../../packages/db/migrations/meta');

interface Table {
  name: string;
  schema: string;
  columns: Record<string, unknown>;
  indexes: Record<string, unknown>;
  foreignKeys: Record<string, unknown>;
  compositePrimaryKeys: Record<string, unknown>;
  uniqueConstraints: Record<string, unknown>;
  policies: Record<string, unknown>;
  checkConstraints: Record<string, unknown>;
  isRLSEnabled: boolean;
}

interface Snapshot {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
  tables: Record<string, Table>;
  enums: Record<string, unknown>;
  schemas: Record<string, unknown>;
  sequences: Record<string, unknown>;
  roles: Record<string, unknown>;
  policies: Record<string, unknown>;
  views: Record<string, unknown>;
  _meta: {
    columns: Record<string, unknown>;
    schemas: Record<string, unknown>;
    tables: Record<string, unknown>;
  };
}

function log(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

function readSnap(idx: string): Snapshot {
  const path = resolve(META_DIR, `${idx}_snapshot.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
}

function writeSnap(idx: string, snap: Snapshot): void {
  const path = resolve(META_DIR, `${idx}_snapshot.json`);
  writeFileSync(path, JSON.stringify(snap, null, 2));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function removeAgentMemoriesScopeDeltas(snap: Snapshot): void {
  const table = snap.tables['public.agent_memories'];
  if (!table) throw new Error('agent_memories table missing in snapshot');

  const colsToDrop = ['scope', 'session_scope', 'source_facts', 'reconciled_at'];
  for (const col of colsToDrop) {
    if (!(col in table.columns)) {
      throw new Error(`agent_memories.${col} column expected but absent`);
    }
    Reflect.deleteProperty(table.columns, col);
  }

  for (const idx of ['agent_memories_scope_idx', 'agent_memories_session_scope_idx']) {
    if (!(idx in table.indexes)) {
      throw new Error(`${idx} expected but absent`);
    }
    Reflect.deleteProperty(table.indexes, idx);
  }

  if (!('agent_memories_scope_check' in table.checkConstraints)) {
    throw new Error('agent_memories_scope_check expected but absent');
  }
  Reflect.deleteProperty(table.checkConstraints, 'agent_memories_scope_check');
}

function removeTable(snap: Snapshot, tableKey: string): void {
  if (!(tableKey in snap.tables)) {
    throw new Error(`${tableKey} expected but absent`);
  }
  Reflect.deleteProperty(snap.tables, tableKey);
}

function summarizeTables(snap: Snapshot): { count: number; sample: string[] } {
  const keys = Object.keys(snap.tables).sort();
  return { count: keys.length, sample: keys.slice(0, 5) };
}

function main(): void {
  log('GAP-166 — backfill snapshots 0002-0005');
  log('');

  const snap0001 = readSnap('0001');
  const snap0006Original = readSnap('0006');

  log(`Read 0001: id=${snap0001.id.slice(0, 8)}.. prevId=${snap0001.prevId.slice(0, 8)}..`);
  log(
    `Read 0006: id=${snap0006Original.id.slice(0, 8)}.. prevId=${snap0006Original.prevId.slice(0, 8)}.. (currently chains direct from 0001 — to be rewired)`,
  );
  log(`  0001 tables: ${summarizeTables(snap0001).count}`);
  log(`  0006 tables: ${summarizeTables(snap0006Original).count}`);
  log('');

  // Mint UUIDs for the 4 new snapshots
  const id0002 = randomUUID();
  const id0003 = randomUUID();
  const id0004 = randomUUID();
  const id0005 = randomUUID();

  // 0005: clone of 0006 (which already captures post-0005 schema state)
  const snap0005 = clone(snap0006Original);
  snap0005.id = id0005;
  snap0005.prevId = id0004;

  // 0004: 0005 minus agent_memories scope deltas (added by 0005 SQL)
  const snap0004 = clone(snap0005);
  snap0004.id = id0004;
  snap0004.prevId = id0003;
  removeAgentMemoriesScopeDeltas(snap0004);

  // 0003: 0004 minus yjs_document_patches table (added by 0004 SQL)
  const snap0003 = clone(snap0004);
  snap0003.id = id0003;
  snap0003.prevId = id0002;
  removeTable(snap0003, 'public.yjs_document_patches');

  // 0002: 0003 minus shared_facts table (added by 0003 SQL)
  const snap0002 = clone(snap0003);
  snap0002.id = id0002;
  snap0002.prevId = snap0001.id;
  removeTable(snap0002, 'public.shared_facts');

  // 0006: rewire prevId from 0001 → new 0005
  const snap0006 = clone(snap0006Original);
  snap0006.prevId = id0005;

  // Sanity: 0002's table set should match 0001's table set (Drizzle-modeled
  // changes from 0002 SQL are tsvector columns + triggers + HNSW indexes,
  // none of which Drizzle models — so 0002 snapshot ≡ 0001 in tables.)
  const tables0001 = new Set(Object.keys(snap0001.tables));
  const tables0002 = new Set(Object.keys(snap0002.tables));
  const onlyIn0002 = [...tables0002].filter((t) => !tables0001.has(t));
  const onlyIn0001 = [...tables0001].filter((t) => !tables0002.has(t));
  if (onlyIn0002.length > 0 || onlyIn0001.length > 0) {
    log('WARNING: 0002 vs 0001 table-set mismatch (informational, not fatal):');
    if (onlyIn0002.length > 0) log(`  in 0002 only: ${onlyIn0002.join(', ')}`);
    if (onlyIn0001.length > 0) log(`  in 0001 only: ${onlyIn0001.join(', ')}`);
  }

  // Write
  writeSnap('0002', snap0002);
  writeSnap('0003', snap0003);
  writeSnap('0004', snap0004);
  writeSnap('0005', snap0005);
  writeSnap('0006', snap0006);

  log('Wrote 5 snapshots:');
  log(
    `  0002: id=${id0002.slice(0, 8)}.. prevId=${snap0001.id.slice(0, 8)}.. (${summarizeTables(snap0002).count} tables — no shared_facts/yjs/scope)`,
  );
  log(
    `  0003: id=${id0003.slice(0, 8)}.. prevId=${id0002.slice(0, 8)}.. (${summarizeTables(snap0003).count} tables — +shared_facts)`,
  );
  log(
    `  0004: id=${id0004.slice(0, 8)}.. prevId=${id0003.slice(0, 8)}.. (${summarizeTables(snap0004).count} tables — +yjs_document_patches)`,
  );
  log(
    `  0005: id=${id0005.slice(0, 8)}.. prevId=${id0004.slice(0, 8)}.. (${summarizeTables(snap0005).count} tables — +agent_memories scope cols/check/indexes)`,
  );
  log(
    `  0006: id=${snap0006.id.slice(0, 8)}.. prevId=${id0005.slice(0, 8)}.. (rewired from ${snap0006Original.prevId.slice(0, 8)}..)`,
  );
  log('');
  log('Chain: 0000 → 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0009 → 0012 → 0013');
  log('');
  log(
    'Next: drop 0002-0005 entries from meta/_custom.json, then `pnpm --filter @revealui/db db:generate` (expect "No schema changes").',
  );
}

main();
