/**
 * stripe-revvault-sync — write seeded Stripe IDs into revvault (source of truth).
 *
 * `seed-stripe.ts` provisions Stripe products/prices/webhook idempotently and
 * produces an env-var map (`STRIPE_*_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, the
 * meter event name, ...). This module writes those values into revvault via
 * `revvault set --force <path>`, using the revvault → Vercel manifest as the
 * single source of truth for the env-key → vault-path mapping. The canonical
 * flow becomes:
 *
 *   seed-stripe (Stripe IaC) → revvault (encrypted source of truth)
 *     → `revvault sync vercel --apply` (vault → Vercel) → billing_catalog
 *
 * so no secret is written to Vercel behind revvault's back (revvault-first, M4).
 *
 * `revvault set` writes `.age` files into the passage-store working tree;
 * committing the passage-store git history (the audit trail) stays an OWNER
 * step, exactly as in the secret-rotation workflow. This module never touches
 * git and never echoes a secret value (logs reference paths only).
 *
 * No regex (M2): the manifest is parsed with string operations only.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface SyncLog {
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

const defaultLog: SyncLog = {
  info: (message) => process.stdout.write(`${message}\n`),
  success: (message) => process.stdout.write(`${message}\n`),
  warn: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
};

/** Pipe a single value into `revvault set --force <path>` via stdin. */
export type RevvaultSetter = (vaultPath: string, value: string) => void;

const defaultSetter: RevvaultSetter = (vaultPath, value) => {
  execFileSync('revvault', ['set', '--force', vaultPath], {
    input: value,
    encoding: 'utf-8',
  });
};

/**
 * Parse `KEY = "revealui/..."` lines from a revvault-vercel manifest into an
 * env-key → vault-path map. Section headers (`[...]`), comments (`#`), arrays,
 * and any value that is not a `revealui/` vault path are ignored. The same key
 * appears under multiple `[projects.*]` blocks mapping to the same path, so a
 * later occurrence simply re-sets the identical value. String ops only.
 */
export function parseManifestEnvKeyToVaultPath(manifestText: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of manifestText.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key.length > 0 && value.startsWith('revealui/')) {
      map.set(key, value);
    }
  }
  return map;
}

export function loadManifestEnvKeyToVaultPath(manifestPath: string): Map<string, string> {
  return parseManifestEnvKeyToVaultPath(readFileSync(manifestPath, 'utf-8'));
}

export interface SyncToRevvaultOptions {
  /** Path to scripts/sync/revvault-vercel.toml */
  manifestPath: string;
  dryRun?: boolean;
  /** Injectable for tests; defaults to a real `revvault set` over stdin. */
  setter?: RevvaultSetter;
  log?: SyncLog;
}

export interface SyncToRevvaultResult {
  /** Vault paths written (or, in dry-run, that would be written). */
  written: string[];
  /** Env keys produced by the seeder that the manifest does not map. */
  skipped: string[];
  /** Vault paths whose write threw. */
  failed: string[];
}

/**
 * Write each produced env var that the manifest maps to a vault path into
 * revvault. Env vars with no manifest path are skipped (for example
 * renewal-tier keys that are not vaulted yet). Per-key failures are collected,
 * not thrown, so one bad write does not abort the rest — the caller inspects
 * `failed` and decides the exit code.
 */
export function syncToRevvault(
  envVars: Record<string, string>,
  options: SyncToRevvaultOptions,
): SyncToRevvaultResult {
  const { manifestPath, dryRun = false, setter = defaultSetter } = options;
  const log = options.log ?? defaultLog;
  const pathByEnvKey = loadManifestEnvKeyToVaultPath(manifestPath);
  const result: SyncToRevvaultResult = { written: [], skipped: [], failed: [] };

  for (const [envKey, value] of Object.entries(envVars)) {
    const vaultPath = pathByEnvKey.get(envKey);
    if (vaultPath === undefined) {
      result.skipped.push(envKey);
      log.warn(`  ${envKey}: no manifest vault path -> skipping revvault write`);
      continue;
    }
    if (dryRun) {
      log.info(`  [dry-run] would write revvault ${vaultPath}`);
      result.written.push(vaultPath);
      continue;
    }
    try {
      setter(vaultPath, value);
      result.written.push(vaultPath);
      log.success(`  Wrote revvault ${vaultPath}`);
    } catch (err) {
      result.failed.push(vaultPath);
      log.error(
        `  Failed revvault ${vaultPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
