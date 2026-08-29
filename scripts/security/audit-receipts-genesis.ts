#!/usr/bin/env tsx

/**
 * Audit receipts genesis (ADR-009 / GAP-486).
 *
 * Pre-customer epoch start: TRUNCATE audit_log + audit_anchors and restart
 * identity so the live receipt chain has no unsigned floor.
 *
 * Default is dry-run (counts only). Apply requires:
 *   AUDIT_RECEIPTS_GENESIS_CONFIRM=TRUNCATE_AUDIT_LOG_AND_AUDIT_ANCHORS
 *   --apply --attest-no-paying-customers
 *
 * Never prints the database URL.
 *
 * Usage:
 *   pnpm genesis:audit-receipts
 *   pnpm genesis:audit-receipts -- --apply --attest-no-paying-customers
 */

import { getClient } from '@revealui/db';
import { auditAnchors, auditLog } from '@revealui/db/schema';
import { sql } from 'drizzle-orm';
import { applyBlockedReason, parseGenesisArgs } from './audit-receipts-genesis-gates.js';

export type { GenesisArgs } from './audit-receipts-genesis-gates.js';
export {
  applyBlockedReason,
  GENESIS_CONFIRM,
  parseGenesisArgs,
} from './audit-receipts-genesis-gates.js';

export interface GenesisCounts {
  auditLogTotal: number;
  auditLogUnsigned: number;
  auditLogTenantScoped: number;
  auditAnchorsTotal: number;
}

function redact(s: string): string {
  return s.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgres://[redacted]');
}

export async function readGenesisCounts(db: ReturnType<typeof getClient>): Promise<GenesisCounts> {
  const [logRow] = await db
    .select({
      auditLogTotal: sql`count(*)::int`.mapWith(Number),
      auditLogUnsigned: sql`count(*) FILTER (WHERE ${auditLog.signature} IS NULL)::int`.mapWith(
        Number,
      ),
      auditLogTenantScoped:
        sql`count(*) FILTER (WHERE ${auditLog.tenant} IS NOT NULL)::int`.mapWith(Number),
    })
    .from(auditLog);
  const [anchorRow] = await db
    .select({
      auditAnchorsTotal: sql`count(*)::int`.mapWith(Number),
    })
    .from(auditAnchors);
  return {
    auditLogTotal: logRow?.auditLogTotal ?? 0,
    auditLogUnsigned: logRow?.auditLogUnsigned ?? 0,
    auditLogTenantScoped: logRow?.auditLogTenantScoped ?? 0,
    auditAnchorsTotal: anchorRow?.auditAnchorsTotal ?? 0,
  };
}

async function main(): Promise<void> {
  const args = parseGenesisArgs(process.argv.slice(2));
  const blocked = applyBlockedReason(args, process.env.AUDIT_RECEIPTS_GENESIS_CONFIRM);
  if (blocked) {
    process.stderr.write(`${blocked}\n`);
    process.exit(2);
  }

  const db = getClient();
  const before = await readGenesisCounts(db);
  process.stdout.write(`${JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', before })}\n`);

  if (!args.apply) {
    process.stdout.write(
      'dry-run only; pass --apply and confirm env to TRUNCATE audit_log + audit_anchors\n',
    );
    return;
  }

  // drizzle-raw: ADR-009 owner DDL. Append-only trigger forbids UPDATE/DELETE; TRUNCATE is the genesis path.
  await db.execute(sql`TRUNCATE TABLE audit_log, audit_anchors RESTART IDENTITY`);
  const after = await readGenesisCounts(db);
  process.stdout.write(`${JSON.stringify({ mode: 'apply', after })}\n`);
  if (after.auditLogTotal !== 0 || after.auditLogUnsigned !== 0 || after.auditAnchorsTotal !== 0) {
    process.stderr.write('genesis apply did not leave empty receipt tables\n');
    process.exit(1);
  }
}

const isDirect =
  Boolean(process.argv[1]) &&
  (process.argv[1]?.endsWith('audit-receipts-genesis.ts') ||
    process.argv[1]?.endsWith('audit-receipts-genesis.js'));

if (isDirect) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`audit-receipts-genesis failed: ${redact(msg)}\n`);
    process.exit(1);
  });
}
