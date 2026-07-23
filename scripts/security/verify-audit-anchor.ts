#!/usr/bin/env tsx

/**
 * Offline audit-anchor verifier (GAP-355 Stage 4 S4-5).
 *
 * Verifies a customer-held Merkle root (and optional inclusion proof) with
 * ONLY the published SPKI public key. **No network. No database.**
 *
 * Inputs are JSON files (or stdin for anchor when --anchor -).
 *
 * Usage:
 *   pnpm verify:audit-anchor -- \
 *     --public-key ./audit-public.pem \
 *     --anchor ./anchor.json \
 *     [--proof ./proof.json]
 *
 *   # or package-style:
 *   pnpm exec tsx scripts/security/verify-audit-anchor.ts --help
 *
 * anchor.json (from GET /api/audit/anchors/:id or export):
 *   {
 *     "tenant": "acct_…",
 *     "seqFrom": 1,
 *     "seqTo": 10,
 *     "leafCount": 10,
 *     "root": "<64-char hex>",
 *     "rootSignature": "v1.ed25519.<kid>.<sig>"
 *   }
 *
 * proof.json (from GET /api/audit/anchors/:id/proof?seq=N):
 *   {
 *     "seq": 5,
 *     "signature": "<row signature string>",
 *     "leafHash": "<optional hex>",
 *     "proof": { "leafIndex": 4, "leafCount": 10, "path": […] }
 *   }
 *
 * Exit: 0 if all checks pass; 1 if any check fails or args are invalid.
 */

import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  type OfflineAnchorRecord,
  type OfflineInclusionProofInput,
  verifyAuditAnchorOffline,
} from '@revealui/security/server';

interface Args {
  publicKeyPath?: string;
  publicKeyPem?: string;
  anchorPath?: string;
  proofPath?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
      i += 1;
    } else if (a === '--public-key' || a === '-p') {
      args.publicKeyPath = argv[i + 1];
      i += 2;
    } else if (a === '--public-key-pem') {
      args.publicKeyPem = argv[i + 1];
      i += 2;
    } else if (a === '--anchor' || a === '-a') {
      args.anchorPath = argv[i + 1];
      i += 2;
    } else if (a === '--proof') {
      args.proofPath = argv[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(`verify-audit-anchor — offline Merkle root + inclusion proof check (GAP-355 S4-5)

Usage:
  pnpm verify:audit-anchor -- --public-key <pem-file> --anchor <json> [--proof <json>]

Options:
  --public-key, -p   Path to SPKI PEM public key (or use REVEALUI_AUDIT_PUBLIC_KEY)
  --public-key-pem   Inline SPKI PEM string
  --anchor, -a       Path to anchor JSON (root + rootSignature + range)
  --proof            Optional path to inclusion proof JSON for one seq
  --help, -h         This help

Exit codes:
  0  all checks passed
  1  verification failed or bad arguments

No network. No database.
`);
}

function resolvePublicKeyPem(args: Args): string | null {
  if (args.publicKeyPem) return args.publicKeyPem;
  if (args.publicKeyPath) return readFileSync(args.publicKeyPath, 'utf8');
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

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function asAnchor(raw: unknown): OfflineAnchorRecord {
  if (!raw || typeof raw !== 'object') {
    throw new Error('anchor JSON must be an object');
  }
  const o = raw as Record<string, unknown>;
  const tenant = String(o.tenant ?? '');
  const seqFrom = Number(o.seqFrom);
  const seqTo = Number(o.seqTo);
  const leafCount = Number(o.leafCount);
  const root = String(o.root ?? '');
  const rootSignature = String(o.rootSignature ?? '');
  if (!(tenant && root && rootSignature)) {
    throw new Error('anchor requires tenant, root, rootSignature, seqFrom, seqTo, leafCount');
  }
  return { tenant, seqFrom, seqTo, leafCount, root, rootSignature };
}

function asProof(raw: unknown): OfflineInclusionProofInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('proof JSON must be an object');
  }
  const o = raw as Record<string, unknown>;
  const seq = Number(o.seq);
  const signature = String(o.signature ?? '');
  const proof = o.proof;
  if (!(signature && proof) || typeof proof !== 'object') {
    throw new Error('proof requires seq, signature, and proof path object');
  }
  const leafHash = o.leafHash != null ? String(o.leafHash) : undefined;
  return {
    seq,
    signature,
    leafHash,
    proof: proof as OfflineInclusionProofInput['proof'],
  };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const publicKeyPem = resolvePublicKeyPem(args);
  if (!publicKeyPem) {
    process.stderr.write(
      'error: provide --public-key <pem>, --public-key-pem, or REVEALUI_AUDIT_PUBLIC_KEY\n',
    );
    return 1;
  }
  if (!args.anchorPath) {
    process.stderr.write('error: --anchor <json> is required\n');
    return 1;
  }

  let anchor: OfflineAnchorRecord;
  let inclusion: OfflineInclusionProofInput | undefined;
  try {
    anchor = asAnchor(readJsonFile(args.anchorPath));
    if (args.proofPath) {
      inclusion = asProof(readJsonFile(args.proofPath));
    }
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }

  const result = verifyAuditAnchorOffline({
    publicKeyPem,
    anchor,
    inclusion,
  });

  for (const line of result.checks) {
    process.stdout.write(`${result.ok ? 'ok' : 'fail'}: ${line}\n`);
  }
  if (result.kid) {
    process.stdout.write(`kid: ${result.kid}\n`);
  }
  process.stdout.write(result.ok ? 'RESULT: PASS\n' : 'RESULT: FAIL\n');
  return result.ok ? 0 : 1;
}

process.exit(main());
