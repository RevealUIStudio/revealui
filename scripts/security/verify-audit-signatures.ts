#!/usr/bin/env tsx

/**
 * Audit-log signature verifier (GAP-355 Stage 3, spec D8).
 *
 * A thin operator tool: reads the N most recent `audit_log` rows (or one row by
 * id), classifies each `signature` value, and — for `v1.ed25519` rows — verifies
 * it OFFLINE against the deployment's public key using the SAME canonicalization
 * (`auditSignableBytes`) + verifier (`verifyAuditRow`) the customer would run.
 * This is the seed the Stage-4 offline CLI grows from, not a separate program.
 *
 * The public key is resolved (in order):
 *   1. --public-key <spki-pem>
 *   2. REVEALUI_AUDIT_PUBLIC_KEY (SPKI PEM)
 *   3. derived from REVEALUI_AUDIT_SIGNING_KEY (private key present on a signer)
 * A single key verifies any kid (single-key deployment); multi-key resolution is
 * Stage-4 territory.
 *
 * Usage:
 *   POSTGRES_URL=$(revvault get --full revealui/prod/postgres-url) \
 *   REVEALUI_AUDIT_PUBLIC_KEY="$(revvault get --full revealui/prod/audit/signing-public-key)" \
 *     tsx scripts/security/verify-audit-signatures.ts --limit 20
 *
 *   ... tsx scripts/security/verify-audit-signatures.ts --id <row-id>
 *
 * Exit code: 0 when every checked row is accounted for (verified, or honestly
 * unsigned/legacy), 1 when any `v1.ed25519` row FAILS verification (tamper).
 */

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { getClient } from '@revealui/db';
import { auditLog } from '@revealui/db/schema';
import {
  type AuditSignable,
  classifyAuditSignature,
  verifyAuditRow,
} from '@revealui/security/server';
import { desc, eq } from 'drizzle-orm';

interface Args {
  id?: string;
  limit: number;
  publicKeyPem?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 20 };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--id') {
      args.id = argv[i + 1];
      i += 2;
    } else if (arg === '--limit') {
      const next = Number(argv[i + 1]);
      if (Number.isFinite(next) && next > 0) args.limit = Math.floor(next);
      i += 2;
    } else if (arg === '--public-key') {
      args.publicKeyPem = argv[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }
  return args;
}

/** SPKI PEM to verify with, or null if none is available in this environment. */
function resolvePublicKeyPem(args: Args): string | null {
  if (args.publicKeyPem) return args.publicKeyPem;
  const fromEnv = process.env.REVEALUI_AUDIT_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  const privatePem = process.env.REVEALUI_AUDIT_SIGNING_KEY;
  if (privatePem) {
    return createPublicKey(createPrivateKey(privatePem))
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }
  return null;
}

function signableFromRow(row: typeof auditLog.$inferSelect): AuditSignable {
  return {
    id: row.id,
    sequence: Number(row.seq),
    tenant: row.tenant,
    timestamp: row.timestamp,
    eventType: row.eventType,
    severity: row.severity,
    agentId: row.agentId,
    taskId: row.taskId,
    sessionId: row.sessionId,
    payload: row.payload,
    policyViolations: row.policyViolations ?? [],
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const db = getClient();

  const rows = args.id
    ? await db.select().from(auditLog).where(eq(auditLog.id, args.id))
    : await db.select().from(auditLog).orderBy(desc(auditLog.seq)).limit(args.limit);

  if (rows.length === 0) {
    console.log('No audit_log rows matched.');
    return 0;
  }

  const publicKeyPem = resolvePublicKeyPem(args);
  const resolvePublicKey = (): string | null => publicKeyPem;

  let failures = 0;
  let unresolved = 0;
  for (const row of rows) {
    const kind = classifyAuditSignature(row.signature);
    const label = `seq=${row.seq} id=${row.id} type=${row.eventType}`;
    if (kind === 'unsigned') {
      console.log(`UNSIGNED     ${label}`);
    } else if (kind === 'legacy-hmac') {
      console.log(`LEGACY-HMAC  ${label} (pre-Stage-3 MCP chain row; not per-row verifiable here)`);
    } else if (kind === 'unknown') {
      failures++;
      console.log(`UNKNOWN-SIG  ${label} — unrecognized signature format`);
    } else {
      // ed25519
      if (!publicKeyPem) {
        unresolved++;
        console.log(`NO-KEY       ${label} — set REVEALUI_AUDIT_PUBLIC_KEY or --public-key`);
        continue;
      }
      const result = verifyAuditRow(signableFromRow(row), row.signature ?? '', resolvePublicKey);
      if (result.valid) {
        console.log(`VERIFIED     ${label} kid=${result.kid ?? '?'}`);
      } else {
        failures++;
        console.log(`FAILED       ${label} — ${result.reason ?? 'signature did not verify'}`);
      }
    }
  }

  console.log(
    `\nChecked ${rows.length} row(s): ${failures} failure(s)${unresolved ? `, ${unresolved} unresolvable (no public key)` : ''}.`,
  );
  return failures > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('verify-audit-signatures failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
