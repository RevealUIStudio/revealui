#!/usr/bin/env tsx
/**
 * Owner-run generator for the staging environment's "generate fresh" secret
 * bucket (GAP-343 Phase 3, docs/lanes/staging-environment/plan.md). Writes
 * directly to revvault under revealui/staging/* - the manifest
 * (scripts/sync/revvault-vercel-staging.toml) then syncs these vault values
 * into Vercel via `pnpm vercel:sync:staging:apply`.
 *
 * What this writes:
 *   - A fresh Ed25519 license-signing keypair, self-verified at generation
 *     time (sign + verify a throwaway token) before being queued for write.
 *     Staging runs no worker, so the usual boot-time canary
 *     (apps/server/src/lib/license-canary.ts, wired from worker.ts) never
 *     runs here - this script is the only check this keypair ever gets.
 *   - REVEALUI_KEK, REVEALUI_SECRET, REVEALUI_CRON_SECRET,
 *     REVEALUI_ADMIN_API_KEY - fresh random values, format-compatible with
 *     apps/server/src/lib/validate-startup.ts's checks (REVEALUI_KEK: 64 hex
 *     chars; the rest: >=32 chars). The retired audit HMAC secret is gone
 *     (GAP-355 Stage 3, per-row Ed25519 signing); staging's audit signing key
 *     is provisioned separately with the rest of the staging bring-up.
 *   - The deterministic staging URL config derived from the amended-B
 *     staging.revealui.com subtree (SESSION_COOKIE_DOMAIN, PASSKEY_RP_ID,
 *     PASSKEY_ORIGIN, PASSKEY_RP_NAME, CORS_ORIGIN, and the two "server url"
 *     concepts the fleet already tracks as separate vault leaves: the admin
 *     app's own origin and the api's own origin).
 *
 * What this deliberately does NOT write (owner sets these by hand, they are
 * not derivable): revealui/staging/alert-email (an inbox, not a secret) and
 * the admin bootstrap REVEALUI_ADMIN_EMAIL / REVEALUI_ADMIN_PASSWORD pair.
 * Stripe test-mode credentials come from Phase 2 (`pnpm stripe:seed`), and
 * POSTGRES_URL from Phase 1 (the owner-run empty Neon branch) - neither is
 * generated here.
 *
 * Safety:
 *   - `--dry-run` runs the full generation + self-verification path (so a
 *     bug in keygen still surfaces) but makes NO revvault calls at all - not
 *     even a read. It prints each path with a value SHAPE (length + kind),
 *     never the value.
 *   - Without `--dry-run`, each path is checked against the live vault first;
 *     an existing value is left untouched (skipped) unless `--force` is
 *     passed. There is no bulk "wipe and regenerate."
 *   - A secret value is NEVER printed or logged, in any mode. Failures print
 *     the vault PATH and the error message only.
 *
 * This script is authored, not run, by the session that wrote it - GAP-343
 * Phase 3 explicitly excludes running it against the real vault from that
 * session's scope. The owner runs it as part of the before-Phase-4 sequence:
 * gen-staging-secrets -> Phase 1 (Neon) -> Phase 2 (Stripe seed) ->
 * `vercel:sync:staging:apply`.
 *
 * Usage:
 *   pnpm tsx scripts/setup/gen-staging-secrets.ts --dry-run
 *   pnpm tsx scripts/setup/gen-staging-secrets.ts
 *   pnpm tsx scripts/setup/gen-staging-secrets.ts --force
 *
 * No regex (M2): every check here is string-method / Set-based.
 */

import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { selfVerifyLicenseKeypair } from '@revealui/core/license';
import { revvaultSecretExists, writeRevvaultSecret } from '@revealui/setup/revvault';

// ─── The staging.revealui.com subtree (lane plan §The URL decision) ──────────
const STAGING_ROOT_DOMAIN = 'staging.revealui.com';
const STAGING_ADMIN_ORIGIN = 'https://admin.staging.revealui.com';
const STAGING_API_ORIGIN = 'https://api.staging.revealui.com';

export type SecretShape =
  | 'hex-64' // REVEALUI_KEK - exactly 64 hex chars
  | 'hex-random' // >=32-char random secret (cron/audit/admin-api-key/session)
  | 'pem-private-ed25519'
  | 'pem-public-ed25519'
  | 'literal'; // deterministic public config, not secret

export interface SecretEntry {
  /** Canonical revvault path this value is written to. */
  path: string;
  shape: SecretShape;
  /** The actual value - NEVER printed; only `describeShape` output is. */
  value: string;
}

function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}

/** Describe a value's SHAPE only - length + kind, never the content. */
export function describeShape(entry: Pick<SecretEntry, 'shape' | 'value'>): string {
  switch (entry.shape) {
    case 'hex-64':
    case 'hex-random':
      return `${entry.value.length} lowercase hex chars`;
    case 'pem-private-ed25519':
      return `PKCS8 Ed25519 private key PEM (${entry.value.split('\n').length} lines)`;
    case 'pem-public-ed25519':
      return `SPKI Ed25519 public key PEM (${entry.value.split('\n').length} lines)`;
    case 'literal':
      return `literal string, ${entry.value.length} chars`;
  }
}

/**
 * Generate the fresh Ed25519 license keypair and self-verify it BEFORE
 * returning it - a keypair that fails its own canary is a generation bug,
 * never queued for write. Mirrors the sign/verify path
 * apps/server/src/lib/license-canary.ts runs at hosted boot (which staging,
 * running no worker, never exercises).
 */
export async function generateVerifiedLicenseKeypair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const canary = await selfVerifyLicenseKeypair(privateKey, [publicKey]);
  if (canary.status !== 'ok') {
    const reason = 'reason' in canary ? canary.reason : undefined;
    throw new Error(
      `freshly generated staging license keypair failed self-verification ` +
        `(status=${canary.status}${reason ? `, reason=${reason}` : ''}). ` +
        'This is a generation bug, not a real-world risk - refusing to queue it for write.',
    );
  }
  return { privateKey, publicKey };
}

/** The full "generate fresh" bucket, in write order. Pure aside from keygen. */
export async function buildEntries(): Promise<SecretEntry[]> {
  const entries: SecretEntry[] = [
    { path: 'revealui/staging/kek', shape: 'hex-64', value: randomHex(32) },
    { path: 'revealui/staging/secret', shape: 'hex-random', value: randomHex(32) },
    { path: 'revealui/staging/cron-secret', shape: 'hex-random', value: randomHex(32) },
    { path: 'revealui/staging/admin/api-key', shape: 'hex-random', value: randomHex(32) },
  ];

  const { privateKey, publicKey } = await generateVerifiedLicenseKeypair();
  entries.push(
    {
      path: 'revealui/staging/license/private-key',
      shape: 'pem-private-ed25519',
      value: privateKey,
    },
    { path: 'revealui/staging/license/public-key', shape: 'pem-public-ed25519', value: publicKey },
  );

  entries.push(
    {
      path: 'revealui/staging/session-cookie-domain',
      shape: 'literal',
      value: STAGING_ROOT_DOMAIN,
    },
    { path: 'revealui/staging/passkey/rp-id', shape: 'literal', value: STAGING_ROOT_DOMAIN },
    { path: 'revealui/staging/passkey/origin', shape: 'literal', value: STAGING_ADMIN_ORIGIN },
    { path: 'revealui/staging/passkey/rp-name', shape: 'literal', value: 'RevealUI Staging' },
    {
      path: 'revealui/staging/cors-origin',
      shape: 'literal',
      value: `https://${STAGING_ROOT_DOMAIN},${STAGING_ADMIN_ORIGIN}`,
    },
    // Fleet convention (mirrors revealui/prod/public/server-url): the "server
    // url" leaf is the ADMIN app's own origin, consumed by apps/admin (self-
    // referential) and apps/server (license domain binding, ADMIN_URL links
    // in billing emails). The api's own origin is the separate "api-url" leaf.
    { path: 'revealui/staging/public/server-url', shape: 'literal', value: STAGING_ADMIN_ORIGIN },
    { path: 'revealui/staging/public/api-url', shape: 'literal', value: STAGING_API_ORIGIN },
  );

  return entries;
}

// ─── Injectable vault I/O (tests supply fakes; never touch real revvault) ────

export type VaultExists = (path: string) => boolean;
export type VaultWrite = (path: string, value: string) => void;

const defaultVaultExists: VaultExists = (path) => revvaultSecretExists(path);

/** Writes `value` to `path` via the shared revvault client (never argv). */
const defaultVaultWrite: VaultWrite = (path, value) => writeRevvaultSecret(path, value);

export interface RunOptions {
  dryRun: boolean;
  force: boolean;
  exists?: VaultExists;
  write?: VaultWrite;
  log?: (line: string) => void;
}

export interface RunResult {
  written: string[];
  skipped: string[];
  failed: string[];
}

/**
 * Write every entry, guarded by the existing-value check unless `--force`.
 * `--dry-run` makes no vault calls at all (not even `exists`) - it only
 * reports the shape of what WOULD be written.
 */
export function runGenerator(entries: readonly SecretEntry[], options: RunOptions): RunResult {
  const { dryRun, force, exists = defaultVaultExists, write = defaultVaultWrite } = options;
  const log = options.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const result: RunResult = { written: [], skipped: [], failed: [] };

  for (const entry of entries) {
    const shape = describeShape(entry);
    if (dryRun) {
      log(`  [dry-run] ${entry.path} -> ${shape}`);
      result.written.push(entry.path);
      continue;
    }
    if (!force && exists(entry.path)) {
      log(`  SKIP ${entry.path} (already set in revvault; pass --force to overwrite)`);
      result.skipped.push(entry.path);
      continue;
    }
    try {
      write(entry.path, entry.value);
      log(`  wrote ${entry.path} (${shape})`);
      result.written.push(entry.path);
    } catch (err) {
      log(`  FAILED ${entry.path}: ${err instanceof Error ? err.message : String(err)}`);
      result.failed.push(entry.path);
    }
  }

  return result;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

interface CliFlags {
  dryRun: boolean;
  force: boolean;
  help: boolean;
}

export function parseCliFlags(argv: readonly string[]): CliFlags {
  const set = new Set(argv);
  return {
    dryRun: set.has('--dry-run'),
    force: set.has('--force'),
    help: set.has('--help') || set.has('-h'),
  };
}

function printUsage(): void {
  process.stdout.write(`Usage: tsx scripts/setup/gen-staging-secrets.ts [--dry-run] [--force]

  --dry-run   Generate + self-verify everything, print vault paths and value
              SHAPES only. Makes no revvault calls (not even a read).
  --force     Overwrite a path that already has a value in revvault. Without
              it, an existing value is left untouched (skipped).
  -h, --help  Show this help.
`);
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  if (flags.help) {
    printUsage();
    return;
  }

  const entries = await buildEntries();

  process.stdout.write('── gen-staging-secrets (GAP-343 Phase 3) ──\n');
  process.stdout.write(
    `${entries.length} paths to ${flags.dryRun ? 'simulate' : 'write'}${flags.force ? ' (--force)' : ''}\n\n`,
  );

  const result = runGenerator(entries, { dryRun: flags.dryRun, force: flags.force });

  process.stdout.write('\n');
  if (flags.dryRun) {
    process.stdout.write(
      `dry-run complete - ${result.written.length} paths simulated, nothing written.\n`,
    );
    return;
  }
  process.stdout.write(
    `${result.written.length} written, ${result.skipped.length} skipped, ${result.failed.length} failed.\n`,
  );
  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
