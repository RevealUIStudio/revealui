/**
 * Pre-deploy environment validator for the api app.
 *
 * Pulls the production env from Vercel (`vercel pull`) and runs the same
 * `validateStartup()` that apps/api executes at module init. Any format /
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
} from '../../apps/api/src/lib/validate-startup';

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

export interface ValidateResult {
  ok: boolean;
  message: string;
  mode: 'forge' | 'hosted';
  stripeLiveMode: boolean;
}

/**
 * Run validateStartup() against a pulled-env record (as returned by
 * parseDotenv). Always injects NODE_ENV=production so the production
 * code path runs. SKIP_ENV_VALIDATION=true is rejected here (rather than
 * silently passing through to validateStartup which honors it) — pulling
 * a production env that contains the bypass flag is itself a config bug.
 */
export function validatePulledEnv(pulled: EnvMap): ValidateResult {
  const env: EnvMap = { ...pulled, NODE_ENV: 'production' };

  const mode = detectDeploymentMode(env);
  const stripeLiveMode = env.STRIPE_LIVE_MODE === 'true';

  if (env.SKIP_ENV_VALIDATION === 'true') {
    return {
      ok: false,
      mode,
      stripeLiveMode,
      message:
        'pulled env contains SKIP_ENV_VALIDATION=true. This bypasses every check at runtime; remove it from Vercel before deploying.',
    };
  }

  try {
    validateStartup(env);
    return {
      ok: true,
      mode,
      stripeLiveMode,
      message: 'all production env presence + format checks satisfied.',
    };
  } catch (err) {
    return {
      ok: false,
      mode,
      stripeLiveMode,
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

  if (!result.ok) {
    process.stderr.write(`validate:prod-env FAIL\n${result.message}\n`);
    process.exit(1);
  }

  process.stdout.write(`validate:prod-env PASS — ${result.message}\n`);
  process.exit(0);
}

const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) main();
