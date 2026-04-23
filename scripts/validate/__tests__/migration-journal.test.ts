import { describe, expect, it } from 'vitest';
import {
  type CustomManifest,
  checkCustomManifestShape,
  checkGhosts,
  checkMonotonicWhen,
  checkOrphans,
  checkSnapshotPresence,
  type Journal,
  lintIdempotency,
} from '../migration-journal.ts';

function entry(idx: number, when: number, tag: string) {
  return { idx, version: '7' as const, when, tag, breakpoints: true };
}

function journal(...entries: ReturnType<typeof entry>[]): Journal {
  return { version: '7', dialect: 'postgresql', entries };
}

describe('checkOrphans', () => {
  it('passes when every SQL tag has a journal entry', () => {
    const result = checkOrphans(
      ['0000_init', '0001_users'],
      journal(entry(0, 1, '0000_init'), entry(1, 2, '0001_users')),
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when an SQL tag is missing from the journal', () => {
    const result = checkOrphans(['0000_init', '0001_orphan'], journal(entry(0, 1, '0000_init')));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('0001_orphan');
  });
});

describe('checkGhosts', () => {
  it('passes when every journal entry has an SQL file', () => {
    const result = checkGhosts(['0000_init'], journal(entry(0, 1, '0000_init')));
    expect(result.ok).toBe(true);
  });

  it('fails when a journal entry has no SQL file', () => {
    const result = checkGhosts(
      ['0000_init'],
      journal(entry(0, 1, '0000_init'), entry(1, 2, '0001_ghost')),
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('0001_ghost');
  });
});

describe('checkMonotonicWhen', () => {
  it('passes when when values are strictly increasing across idx order', () => {
    const result = checkMonotonicWhen(
      journal(entry(0, 100, '0000_a'), entry(1, 200, '0001_b'), entry(2, 300, '0002_c')),
    );
    expect(result.ok).toBe(true);
  });

  it('fails when a later idx has an earlier when', () => {
    // The exact 2026-04-19 bug: 0006.when (Mar 18) earlier than 0005.when (Mar 22).
    const result = checkMonotonicWhen(
      journal(
        entry(5, 1776912000000, '0005_shared_memory_scope'),
        entry(6, 1776579007043, '0006_must_rotate_password'),
      ),
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('0006_must_rotate_password');
    expect(result.errors[0]).toContain('0005_shared_memory_scope');
  });

  it('fails when two adjacent entries have equal when values', () => {
    const result = checkMonotonicWhen(journal(entry(0, 100, '0000_a'), entry(1, 100, '0001_b')));
    expect(result.ok).toBe(false);
  });

  it('sorts by idx before checking, not by array order', () => {
    // Out-of-order in the array but sorted by idx the values are monotonic.
    const result = checkMonotonicWhen(
      journal(entry(2, 300, '0002_c'), entry(0, 100, '0000_a'), entry(1, 200, '0001_b')),
    );
    expect(result.ok).toBe(true);
  });
});

describe('lintIdempotency', () => {
  it('passes a wrapped ADD CONSTRAINT', () => {
    const sql = `
      DO $$ BEGIN
        ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_scope_check"
          CHECK (scope IN ('private', 'shared', 'reconciled'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    expect(lintIdempotency('0099_test', sql).ok).toBe(true);
  });

  it('fails an unwrapped ADD CONSTRAINT (the 2026-04-19 bug)', () => {
    const sql = `
      ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_scope_check"
        CHECK (scope IN ('private', 'shared', 'reconciled'));
    `;
    const result = lintIdempotency('0099_test', sql);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('ADD CONSTRAINT');
  });

  it('fails DROP CONSTRAINT without IF EXISTS', () => {
    const sql = `ALTER TABLE "users" DROP CONSTRAINT "old_check";`;
    const result = lintIdempotency('0099_test', sql);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('DROP CONSTRAINT');
  });

  it('passes DROP CONSTRAINT IF EXISTS', () => {
    const sql = `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "old_check";`;
    expect(lintIdempotency('0099_test', sql).ok).toBe(true);
  });

  it('passes mixed file when only the ADD CONSTRAINT is wrapped', () => {
    const sql = `
      ALTER TABLE "x" ADD COLUMN IF NOT EXISTS "scope" text;
      DO $$ BEGIN
        ALTER TABLE "x" ADD CONSTRAINT "x_check" CHECK (scope IN ('a','b'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      CREATE INDEX IF NOT EXISTS "x_idx" ON "x" ("scope");
    `;
    expect(lintIdempotency('0099_test', sql).ok).toBe(true);
  });

  it('skips files in the explicit allowlist (drizzle-kit-generated baselines)', () => {
    const sql = `ALTER TABLE "x" ADD CONSTRAINT "y" CHECK (true);`;
    // 0000_init is in IDEMPOTENCY_LINT_ALLOWLIST.
    expect(lintIdempotency('0000_init', sql).ok).toBe(true);
  });
});

function manifest(...entries: CustomManifest['custom']): CustomManifest {
  return { version: 1, custom: entries };
}

describe('checkSnapshotPresence', () => {
  it('skips tags listed in _custom.json with missingSnapshot: true', () => {
    // The actual snapshot files don't exist for these synthetic tags, but
    // they're exempted via the manifest, so the check passes.
    const result = checkSnapshotPresence(
      journal(entry(0, 1, '0000_synthetic_no_snapshot')),
      manifest({
        tag: '0000_synthetic_no_snapshot',
        rationale: 'synthetic test fixture (>= 16 chars)',
        missingSnapshot: true,
        snapshotDebtNote: 'n/a',
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('checkCustomManifestShape', () => {
  it('passes a well-formed manifest', () => {
    const result = checkCustomManifestShape(
      manifest({
        tag: '0002_triggers_search_vectors',
        rationale: 'PG triggers and HNSW vector indexes — not Drizzle DSL expressible',
        missingSnapshot: true,
        snapshotDebtNote: 'snapshot would be a copy of 0001 — omitted',
      }),
      journal(entry(2, 100, '0002_triggers_search_vectors')),
    );
    expect(result.ok).toBe(true);
  });

  it('fails when an entry references a tag absent from the journal', () => {
    const result = checkCustomManifestShape(
      manifest({
        tag: '9999_phantom',
        rationale: 'this tag does not exist in the journal at all',
      }),
      journal(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('9999_phantom');
  });

  it('fails when an entry has a too-short rationale', () => {
    const result = checkCustomManifestShape(
      manifest({ tag: '0002_x', rationale: 'short' }),
      journal(entry(2, 100, '0002_x')),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('rationale of at least 16');
  });

  it('fails when missingSnapshot: true but no snapshotDebtNote', () => {
    const result = checkCustomManifestShape(
      manifest({
        tag: '0002_x',
        rationale: 'a sufficiently long rationale string for the lint',
        missingSnapshot: true,
      }),
      journal(entry(2, 100, '0002_x')),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('snapshotDebtNote');
  });

  it('fails on duplicate entries for the same tag', () => {
    const result = checkCustomManifestShape(
      manifest(
        { tag: '0002_x', rationale: 'first entry, sufficiently long rationale' },
        { tag: '0002_x', rationale: 'second entry, also sufficiently long' },
      ),
      journal(entry(2, 100, '0002_x')),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Duplicate');
  });
});
