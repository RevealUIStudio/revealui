/**
 * Pre-deploy environment validator for the api app.
 *
 * Pulls the production env from Vercel (`vercel pull`) and runs the same
 * `validateStartup()` that apps/server executes at module init. Any format /
 * presence error fails the CI gate before deploy starts, instead of
 * surfacing as a FUNCTION_INVOCATION_FAILED crash loop after the
 * deployment is already live.
 *
 * Closes the gap that surfaced during the 2026-04-25 #540 incident: the
 * old bash gate only grep-matched env names against `vercel env ls`
 * output and missed (a) several required vars and (b) every value-format
 * rule (sk_live/test prefix, KEK 64-hex, ≥32-char secrets, HTTPS-only
 * URLs, alert-email shape, etc.).
 *
 * Reads `.vercel/.env.production.local` (produced by `vercel pull
 * --environment=production` against the api project). Injects
 * `NODE_ENV=production` because Vercel's pulled env file does not
 * include it (Vercel sets NODE_ENV at runtime).
 *
 * Local usage:
 *   VERCEL_PROJECT_ID=prj_zk6EQijYXwd9L7BccuBssi436ktM \
 *     vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
 *   pnpm validate:prod-env
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  detectDeploymentMode,
  type EnvMap,
  validateStartup,
} from '../../apps/server/src/lib/validate-startup';

export const ENV_FILE_DEFAULT = '.vercel/.env.production.local';

export function parseDotenv(content: string): EnvMap {
  const env: EnvMap = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\n/g, '\n');
  }
  return env;
}

/**
 * Detect Vercel's v2 encryption envelope.
 *
 * Around 2026-05-05/06 Vercel rolled out a change where `vercel pull`
 * returns ciphertext for `encrypted`-type env vars (previously plaintext).
 * The value comes back as base64 of `{"v":"v2","c":"<ciphertext>","k":[...]}`
 * — server-side decryption happens at runtime in the Vercel platform, not
 * client-side in the CLI. Every revealui main Deploy from 2026-05-06
 * onward failed `validate:prod-env` because the validator tried to URL-
 * parse and HTTPS-check what is actually opaque ciphertext.
 *
 * This helper detects the envelope so the CI gate can treat such values
 * as opaque (skip format checks; presence-by-name still passes). The
 * apps/server runtime continues to receive decrypted plaintext from
 * Vercel and runs strict validateStartup() there, so the real production
 * gate is unaffected.
 *
 * The prefix `eyJ2IjoidjIi` is the base64 encoding of `{"v":"v2"` — a
 * 12-char marker with ~10^17 entropy; accidental collision with a real
 * env value is impossible in practice. We additionally JSON-decode and
 * check for `v: 'v2'` + a `c` field to eliminate any residual ambiguity.
 */
export function isVercelEncryptedBlob(value: string): boolean {
  if (!value.startsWith('eyJ2IjoidjIi')) return false;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return false;
    if (!('v' in parsed && 'c' in parsed)) return false;
    return (parsed as { v: unknown }).v === 'v2';
  } catch {
    return false;
  }
}

/**
 * Scrub Vercel v2 encryption envelopes from a pulled env map. Each opaque
 * value is replaced with an empty string so the lenient validator skips
 * format checks (same path Vercel-Sensitive vars already take). Returns
 * the new map plus a list of keys that were scrubbed (for diagnostics).
 */
export function scrubVercelEncryptedBlobs(env: EnvMap): {
  env: EnvMap;
  scrubbedKeys: string[];
} {
  const scrubbedKeys: string[] = [];
  const result: EnvMap = {};
  for (const [key, value] of Object.entries(env)) {
    if (isVercelEncryptedBlob(value)) {
      result[key] = '';
      scrubbedKeys.push(key);
    } else {
      result[key] = value;
    }
  }
  return { env: result, scrubbedKeys };
}

/**
 * Detect the redaction placeholder Vercel CLI >= 56.3 writes for
 * `sensitive`-type env vars in `vercel pull` output.
 *
 * Sensitive vars are write-only by contract ("can never be read via any
 * REST call" per Vercel's docs). CLI 56.2.1 and earlier pulled them as
 * EMPTY strings, which the lenient validator already skips format checks
 * on. CLI 56.3.1 (first seen in the 2026-07-17 main Deploy, run
 * 29559213155) started writing the literal string `[SENSITIVE]` instead —
 * non-empty, so every format check fired and the deploy failed with 10
 * findings that were all sensitive-type vars. The stored project env had
 * not changed since 2026-07-11.
 *
 * Exact match only: the placeholder is emitted verbatim by the CLI, and
 * no real production value equals it.
 */
export const VERCEL_SENSITIVE_PLACEHOLDER = '[SENSITIVE]';

export function isVercelSensitivePlaceholder(value: string): boolean {
  return value === VERCEL_SENSITIVE_PLACEHOLDER;
}

/**
 * Scrub `[SENSITIVE]` redaction placeholders from a pulled env map,
 * replacing each with an empty string so the value rejoins the lenient
 * path sensitive vars took before CLI 56.3 (presence-by-name passes,
 * format checks skip). The apps/server runtime receives real decrypted
 * values from Vercel and runs strict validateStartup() there, so the
 * production gate is unaffected — same contract as the v2-envelope scrub
 * above.
 */
export function scrubSensitivePlaceholders(env: EnvMap): {
  env: EnvMap;
  scrubbedKeys: string[];
} {
  const scrubbedKeys: string[] = [];
  const result: EnvMap = {};
  for (const [key, value] of Object.entries(env)) {
    if (isVercelSensitivePlaceholder(value)) {
      result[key] = '';
      scrubbedKeys.push(key);
    } else {
      result[key] = value;
    }
  }
  return { env: result, scrubbedKeys };
}

export interface ValidateResult {
  ok: boolean;
  message: string;
  mode: 'forge' | 'hosted';
  stripeLiveMode: boolean;
  scrubbedBlobKeys: string[];
  scrubbedSensitiveKeys: string[];
}

/**
 * Run validateStartup() against a pulled-env record (as returned by
 * parseDotenv). Always injects NODE_ENV=production so the production
 * code path runs. SKIP_ENV_VALIDATION=true is rejected here (rather than
 * silently passing through to validateStartup which honors it) — pulling
 * a production env that contains the bypass flag is itself a config bug.
 */
export function validatePulledEnv(pulled: EnvMap): ValidateResult {
  // Vercel rolled out v2 envelope encryption for `encrypted`-type env
  // vars around 2026-05-06. The CLI pull now returns ciphertext; treat
  // these as opaque so format checks skip on them (presence still passes).
  // The apps/server runtime still receives decrypted values from Vercel
  // and runs strict validateStartup() there. See isVercelEncryptedBlob
  // for the detection contract.
  const { env: blobScrubbed, scrubbedKeys } = scrubVercelEncryptedBlobs(pulled);
  // CLI >= 56.3 writes `[SENSITIVE]` for sensitive-type vars where older
  // CLIs wrote empty strings; scrub the placeholder back to empty so those
  // vars rejoin the lenient presence-only path. See
  // isVercelSensitivePlaceholder for the incident record.
  const { env: scrubbed, scrubbedKeys: scrubbedSensitiveKeys } =
    scrubSensitivePlaceholders(blobScrubbed);
  const env: EnvMap = { ...scrubbed, NODE_ENV: 'production' };

  // Vercel-Sensitive vars pull as empty strings even though they're
  // populated at runtime. Run validateStartup in lenient mode here so
  // presence-by-name passes for sensitive vars and format checks skip
  // on empty values (the runtime invocation in apps/server still runs
  // strict and catches misconfig there). See validate-startup.ts
  // ValidateOptions for the full rationale.
  const opts = { lenient: true };

  const mode = detectDeploymentMode(env, opts);
  const stripeLiveMode = env.STRIPE_LIVE_MODE === 'true';

  if (env.SKIP_ENV_VALIDATION === 'true') {
    return {
      ok: false,
      mode,
      stripeLiveMode,
      scrubbedBlobKeys: scrubbedKeys,
      scrubbedSensitiveKeys,
      message:
        'pulled env contains SKIP_ENV_VALIDATION=true. This bypasses every check at runtime; remove it from Vercel before deploying.',
    };
  }

  try {
    validateStartup(env, opts);
    return {
      ok: true,
      mode,
      stripeLiveMode,
      scrubbedBlobKeys: scrubbedKeys,
      scrubbedSensitiveKeys,
      message: 'all production env presence + format checks satisfied.',
    };
  } catch (err) {
    return {
      ok: false,
      mode,
      stripeLiveMode,
      scrubbedBlobKeys: scrubbedKeys,
      scrubbedSensitiveKeys,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function main(): void {
  const envFile = resolve(process.cwd(), ENV_FILE_DEFAULT);

  if (!existsSync(envFile)) {
    process.stderr.write(
      `validate:prod-env FAIL — ${envFile} not found.\n` +
        '  Run `vercel pull --yes --environment=production --token="$VERCEL_TOKEN"` first.\n',
    );
    process.exit(1);
  }

  const pulled = parseDotenv(readFileSync(envFile, 'utf8'));
  const result = validatePulledEnv(pulled);

  process.stdout.write(
    `validate:prod-env mode=${result.mode} STRIPE_LIVE_MODE=${result.stripeLiveMode}\n`,
  );

  if (result.scrubbedBlobKeys.length > 0) {
    process.stdout.write(
      `validate:prod-env note: ${result.scrubbedBlobKeys.length} Vercel v2 encryption envelope(s) treated as opaque (presence checked, format skipped — runtime gets decrypted values). Keys: ${result.scrubbedBlobKeys.join(', ')}\n`,
    );
  }

  if (result.scrubbedSensitiveKeys.length > 0) {
    process.stdout.write(
      `validate:prod-env note: ${result.scrubbedSensitiveKeys.length} sensitive-type var(s) pulled as the [SENSITIVE] redaction placeholder (CLI >= 56.3); presence checked, format skipped — runtime gets decrypted values. Keys: ${result.scrubbedSensitiveKeys.join(', ')}\n`,
    );
  }

  if (!result.ok) {
    process.stderr.write(`validate:prod-env FAIL\n${result.message}\n`);
    process.exit(1);
  }

  process.stdout.write(`validate:prod-env PASS — ${result.message}\n`);
  process.exit(0);
}

const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) main();
