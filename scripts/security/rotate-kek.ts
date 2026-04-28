#!/usr/bin/env tsx

/**
 * KEK rotation tool — re-encrypt every KEK-encrypted row with a new key.
 *
 * Two surfaces in scope (per the GAP-126 Phase 1 survey at
 * `revealui-jv/docs/security/kek-encrypted-surfaces.md`):
 *
 *   1. user_api_keys.encrypted_key  (NOT NULL, strict envelope)
 *   2. users.mfa_secret             (NULLABLE, rolling-migration aware)
 *
 * Rolling-migration awareness only applies to mfa_secret: legacy plaintext
 * values are encrypted with NEW_KEK in place. api-keys rejects plaintext —
 * a non-envelope value there indicates corruption.
 *
 * Idempotency: every row is first decrypt-tested with NEW_KEK. If it
 * verifies, the row is already rotated and the script skips. If it throws
 * (auth-tag mismatch from the GCM cipher), the row is decrypted with
 * OLD_KEK and re-encrypted under NEW_KEK.
 *
 * The script reads keys from explicit env vars `REVEALUI_KEK_OLD` and
 * `REVEALUI_KEK_NEW`, NOT `REVEALUI_KEK`. This prevents a misconfigured
 * environment from accidentally re-encrypting under the same key.
 *
 * Local usage:
 *
 *   POSTGRES_URL=$(revvault get revealui/dev/postgres-url) \
 *   REVEALUI_KEK_OLD=$(revvault get revealui/dev/kek) \
 *   REVEALUI_KEK_NEW=$(openssl rand -hex 32) \
 *     pnpm validate:kek-rotation:dry-run
 *
 *   # Then with --execute to write:
 *   POSTGRES_URL=... REVEALUI_KEK_OLD=... REVEALUI_KEK_NEW=... \
 *     tsx scripts/security/rotate-kek.ts --execute
 */

import { Pool } from 'pg';

import { decryptWithKey, encryptWithKey, isEncryptedField } from '../../packages/db/src/crypto';

// ============================================================================
// Pure rotation decision (testable without a DB)
// ============================================================================

export type RotationDecision =
  | { kind: 'rotate'; newValue: string }
  | { kind: 'skip-already-new' }
  | { kind: 'plaintext-encrypt'; newValue: string }
  | { kind: 'error'; reason: string };

/**
 * Decide what to do with a single row's encrypted-or-plaintext value.
 *
 * @param value           Current stored value (envelope or plaintext)
 * @param oldKek          32-byte buffer for OLD_KEK
 * @param newKek          32-byte buffer for NEW_KEK
 * @param allowPlaintext  True iff this surface tolerates legacy plaintext
 *                        (mfa_secret yes, encrypted_key no)
 */
export function planRotation(
  value: string,
  oldKek: Buffer,
  newKek: Buffer,
  options: { allowPlaintext: boolean },
): RotationDecision {
  if (!isEncryptedField(value)) {
    if (options.allowPlaintext) {
      try {
        return { kind: 'plaintext-encrypt', newValue: encryptWithKey(newKek, value) };
      } catch (err) {
        return {
          kind: 'error',
          reason: `failed to encrypt legacy plaintext: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    return {
      kind: 'error',
      reason: 'value is not in encrypted-envelope format and surface does not allow plaintext',
    };
  }

  // Idempotency probe: try NEW_KEK first. If it verifies, this row is
  // already rotated. If it throws (auth-tag mismatch), we know the row
  // is encrypted under a different key — almost certainly OLD_KEK.
  try {
    decryptWithKey(newKek, value);
    return { kind: 'skip-already-new' };
  } catch {
    // Fall through to OLD_KEK attempt.
  }

  let plain: string;
  try {
    plain = decryptWithKey(oldKek, value);
  } catch (err) {
    return {
      kind: 'error',
      reason: `value not decryptable under OLD_KEK or NEW_KEK: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    return { kind: 'rotate', newValue: encryptWithKey(newKek, plain) };
  } catch (err) {
    return {
      kind: 'error',
      reason: `failed to re-encrypt under NEW_KEK: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================================
// Per-surface rotation (uses an injected DataSource for testability)
// ============================================================================

export type Surface = 'api-keys' | 'mfa';

export const ALL_SURFACES: readonly Surface[] = ['api-keys', 'mfa'] as const;

export interface SurfaceRow {
  id: string;
  value: string | null;
}

export interface DataSource {
  count(surface: Surface): Promise<number>;
  iterate(surface: Surface, fromId: string, batchSize: number): AsyncIterable<SurfaceRow>;
  update(surface: Surface, id: string, newValue: string): Promise<void>;
}

export interface RotationCounts {
  scanned: number;
  rotated: number;
  skippedAlreadyNew: number;
  plaintextEncrypted: number;
  skippedNullOrEmpty: number;
  errors: Array<{ id: string; reason: string }>;
  lastId: string;
}

const SURFACE_OPTIONS: Record<Surface, { allowPlaintext: boolean }> = {
  'api-keys': { allowPlaintext: false },
  mfa: { allowPlaintext: true },
};

export async function rotateSurface(
  source: DataSource,
  surface: Surface,
  oldKek: Buffer,
  newKek: Buffer,
  options: { dryRun: boolean; fromId?: string; batchSize?: number },
): Promise<RotationCounts> {
  const counts: RotationCounts = {
    scanned: 0,
    rotated: 0,
    skippedAlreadyNew: 0,
    plaintextEncrypted: 0,
    skippedNullOrEmpty: 0,
    errors: [],
    lastId: options.fromId ?? '',
  };

  const surfaceOpts = SURFACE_OPTIONS[surface];
  const batchSize = options.batchSize ?? 200;

  for await (const row of source.iterate(surface, options.fromId ?? '', batchSize)) {
    counts.scanned += 1;
    counts.lastId = row.id;

    if (row.value === null || row.value === '') {
      counts.skippedNullOrEmpty += 1;
      continue;
    }

    const decision = planRotation(row.value, oldKek, newKek, surfaceOpts);

    switch (decision.kind) {
      case 'skip-already-new':
        counts.skippedAlreadyNew += 1;
        break;
      case 'rotate':
        if (!options.dryRun) await source.update(surface, row.id, decision.newValue);
        counts.rotated += 1;
        break;
      case 'plaintext-encrypt':
        if (!options.dryRun) await source.update(surface, row.id, decision.newValue);
        counts.plaintextEncrypted += 1;
        break;
      case 'error':
        counts.errors.push({ id: row.id, reason: decision.reason });
        break;
    }
  }

  return counts;
}

// ============================================================================
// Postgres data source (production driver)
// ============================================================================

interface SurfaceQueries {
  table: string;
  valueCol: string;
  whereClause: string;
}

const SURFACE_QUERIES: Record<Surface, SurfaceQueries> = {
  'api-keys': {
    table: 'user_api_keys',
    valueCol: 'encrypted_key',
    // Include soft-deleted rows: production code can still try to decrypt
    // them (e.g., admin-side audit views), so they need to rotate too.
    whereClause: '',
  },
  mfa: {
    table: 'users',
    valueCol: 'mfa_secret',
    whereClause: 'WHERE mfa_secret IS NOT NULL',
  },
};

export class PostgresDataSource implements DataSource {
  constructor(private readonly pool: Pool) {}

  async count(surface: Surface): Promise<number> {
    const q = SURFACE_QUERIES[surface];
    const sql = `SELECT COUNT(*)::int AS n FROM ${q.table} ${q.whereClause}`;
    const result = await this.pool.query<{ n: number }>(sql);
    return result.rows[0]?.n ?? 0;
  }

  async *iterate(surface: Surface, fromId: string, batchSize: number): AsyncIterable<SurfaceRow> {
    const q = SURFACE_QUERIES[surface];
    let cursor = fromId;
    while (true) {
      const cursorClause = q.whereClause ? `${q.whereClause} AND id > $1` : 'WHERE id > $1';
      const sql = `SELECT id, ${q.valueCol} AS value FROM ${q.table} ${cursorClause} ORDER BY id ASC LIMIT $2`;
      const result = await this.pool.query<SurfaceRow>(sql, [cursor, batchSize]);
      if (result.rows.length === 0) return;
      for (const row of result.rows) {
        yield row;
        cursor = row.id;
      }
      if (result.rows.length < batchSize) return;
    }
  }

  async update(surface: Surface, id: string, newValue: string): Promise<void> {
    const q = SURFACE_QUERIES[surface];
    await this.pool.query(`UPDATE ${q.table} SET ${q.valueCol} = $1 WHERE id = $2`, [newValue, id]);
  }
}

// ============================================================================
// CLI entry
// ============================================================================

interface Flags {
  surface: Surface | 'all';
  dryRun: boolean;
  fromId?: string;
  batchSize: number;
}

function parseFlags(argv: string[]): Flags {
  let surface: Surface | 'all' = 'all';
  let dryRun = true; // safe default — must opt in to writes via --execute
  let fromId: string | undefined;
  let batchSize = 200;

  for (const arg of argv) {
    if (arg === '--execute') dryRun = false;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--surface=')) {
      const value = arg.split('=')[1];
      if (value === 'api-keys' || value === 'mfa' || value === 'all') {
        surface = value;
      } else {
        throw new Error(`Unknown --surface=${value}; expected api-keys|mfa|all`);
      }
    } else if (arg.startsWith('--from=')) {
      fromId = arg.split('=')[1];
    } else if (arg.startsWith('--batch-size=')) {
      const n = Number(arg.split('=')[1]);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(
          `Invalid --batch-size; expected positive integer, got ${arg.split('=')[1]}`,
        );
      }
      batchSize = n;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return { surface, dryRun, fromId, batchSize };
}

function readKekEnv(name: string): Buffer {
  const hex = process.env[name];
  if (!hex) {
    throw new Error(`${name} environment variable is not set`);
  }
  if (hex.length !== 64) {
    throw new Error(`${name} must be exactly 64 hex characters (got ${hex.length})`);
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(
      `${name} did not decode to 32 bytes (got ${buf.length}); check for non-hex chars`,
    );
  }
  return buf;
}

function formatCounts(surface: Surface, counts: RotationCounts): string {
  const errSummary =
    counts.errors.length === 0
      ? 'errors=0'
      : `errors=${counts.errors.length} (first: ${counts.errors[0]?.id} — ${counts.errors[0]?.reason})`;
  return [
    `[${surface}]`,
    `scanned=${counts.scanned}`,
    `rotated=${counts.rotated}`,
    `skipped_already_new=${counts.skippedAlreadyNew}`,
    `plaintext_encrypted=${counts.plaintextEncrypted}`,
    `skipped_null=${counts.skippedNullOrEmpty}`,
    errSummary,
    `last_id=${counts.lastId || '(none)'}`,
  ].join(' ');
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  const oldKek = readKekEnv('REVEALUI_KEK_OLD');
  const newKek = readKekEnv('REVEALUI_KEK_NEW');

  if (oldKek.equals(newKek)) {
    process.stderr.write(
      'rotate-kek FAIL — REVEALUI_KEK_OLD and REVEALUI_KEK_NEW are identical; nothing to rotate.\n',
    );
    process.exit(1);
  }

  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    process.stderr.write('rotate-kek FAIL — POSTGRES_URL environment variable is not set.\n');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: postgresUrl });
  const source = new PostgresDataSource(pool);

  const surfaces: Surface[] = flags.surface === 'all' ? [...ALL_SURFACES] : [flags.surface];

  process.stdout.write(
    `rotate-kek mode=${flags.dryRun ? 'dry-run' : 'EXECUTE'} surface=${flags.surface} batch=${flags.batchSize}` +
      `${flags.fromId ? ` from=${flags.fromId}` : ''}\n`,
  );

  let totalErrors = 0;
  try {
    for (const surface of surfaces) {
      const total = await source.count(surface);
      process.stdout.write(`[${surface}] total_rows=${total}\n`);

      const counts = await rotateSurface(source, surface, oldKek, newKek, {
        dryRun: flags.dryRun,
        fromId: flags.fromId,
        batchSize: flags.batchSize,
      });
      totalErrors += counts.errors.length;
      process.stdout.write(`${formatCounts(surface, counts)}\n`);
      if (counts.errors.length > 0) {
        for (const err of counts.errors.slice(0, 10)) {
          process.stderr.write(`[${surface}] error id=${err.id}: ${err.reason}\n`);
        }
        if (counts.errors.length > 10) {
          process.stderr.write(`[${surface}] ... and ${counts.errors.length - 10} more errors\n`);
        }
      }
    }
  } finally {
    await pool.end();
  }

  if (totalErrors > 0) {
    process.stderr.write(`rotate-kek FAIL — ${totalErrors} row(s) errored.\n`);
    process.exit(1);
  }

  process.stdout.write(
    `rotate-kek ${flags.dryRun ? 'DRY-RUN COMPLETE' : 'EXECUTE COMPLETE'} — no errors.\n`,
  );
  process.exit(0);
}

const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) {
  main().catch((err) => {
    process.stderr.write(
      `rotate-kek crashed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}
