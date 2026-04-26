#!/usr/bin/env tsx
/**
 * Issue a per-customer Forge license JWT.
 *
 * Thin CLI wrapper around `@revealui/core/forge-license`. Reads the studio's
 * RSA keypair from REVEALUI_LICENSE_PRIVATE_KEY / REVEALUI_LICENSE_PUBLIC_KEY,
 * parses argv, prints the signed JWT (or full JSON metadata with --json).
 *
 * Required env (source from revvault):
 *   REVEALUI_LICENSE_PRIVATE_KEY   RS256 PEM
 *   REVEALUI_LICENSE_PUBLIC_KEY    RS256 PEM
 *
 * Usage:
 *   revvault export-env -- pnpm tsx scripts/setup/issue-forge-license.ts \
 *     --slug allevia --tier enterprise --expires-in-days 30
 *
 *   # Perpetual (one-time purchase), full JSON output
 *   ... --slug bigcorp --tier enterprise --perpetual --json
 */

import { parseArgs } from 'node:util';
import {
  type ForgeTier,
  type IssueForgeLicenseOptions,
  issueForgeLicense,
  VALID_FORGE_TIERS,
} from '@revealui/core/forge-license';

interface ParsedCli {
  json: boolean;
  options: IssueForgeLicenseOptions;
}

export function parseCliArgs(argv: string[]): ParsedCli {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      slug: { type: 'string' },
      tier: { type: 'string' },
      'expires-in-days': { type: 'string' },
      perpetual: { type: 'boolean', default: false },
      'max-sites': { type: 'string' },
      'max-users': { type: 'string' },
      domains: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (!values.slug) {
    throw new Error('Missing required --slug.');
  }
  if (!values.tier) {
    throw new Error('Missing required --tier.');
  }
  if (!VALID_FORGE_TIERS.includes(values.tier as ForgeTier)) {
    throw new Error(
      `Invalid --tier "${values.tier}": must be one of ${VALID_FORGE_TIERS.join(', ')}.`,
    );
  }

  const options: IssueForgeLicenseOptions = {
    slug: values.slug,
    tier: values.tier as ForgeTier,
    perpetual: values.perpetual === true,
  };

  if (values['expires-in-days'] !== undefined) {
    const n = Number.parseInt(values['expires-in-days'], 10);
    if (!Number.isFinite(n)) {
      throw new Error(`--expires-in-days must be a number, got "${values['expires-in-days']}".`);
    }
    options.expiresInDays = n;
  }
  if (values['max-sites'] !== undefined) {
    const n = Number.parseInt(values['max-sites'], 10);
    if (!Number.isFinite(n)) {
      throw new Error(`--max-sites must be a number, got "${values['max-sites']}".`);
    }
    options.maxSites = n;
  }
  if (values['max-users'] !== undefined) {
    const n = Number.parseInt(values['max-users'], 10);
    if (!Number.isFinite(n)) {
      throw new Error(`--max-users must be a number, got "${values['max-users']}".`);
    }
    options.maxUsers = n;
  }
  if (values.domains !== undefined) {
    options.domains = values.domains
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  return { json: values.json === true, options };
}

function printUsage(): void {
  process.stdout.write(`Usage: tsx scripts/setup/issue-forge-license.ts --slug <slug> --tier <tier> [options]

Required:
  --slug SLUG               Customer slug (becomes customerId in the JWT;
                            must match ^[a-z0-9][a-z0-9-]*$).
  --tier TIER               'pro' | 'max' | 'enterprise'.

Options:
  --expires-in-days N       JWT expiry in days. Omit for the 365-day default.
  --perpetual               One-time purchase, no expiry. Mutually exclusive
                            with --expires-in-days.
  --max-sites N             Override per-tier site cap.
  --max-users N             Override per-tier user cap.
  --domains a.com,b.com     Allowed deployment hostnames (optional).
  --json                    Emit full JSON metadata (default: JWT only).
  -h, --help                Show this help.

Required env (source from revvault):
  REVEALUI_LICENSE_PRIVATE_KEY  RS256 private key (PEM, may be \\n-encoded).
  REVEALUI_LICENSE_PUBLIC_KEY   RS256 public key (PEM, may be \\n-encoded).

Examples:
  # 30-day trial license for Allevia
  revvault export-env -- pnpm tsx scripts/setup/issue-forge-license.ts \\
    --slug allevia --tier enterprise --expires-in-days 30

  # Perpetual enterprise license, full JSON output
  revvault export-env -- pnpm tsx scripts/setup/issue-forge-license.ts \\
    --slug bigcorp --tier enterprise --perpetual --json
`);
}

function readPemEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(
      `Missing ${name}. Source it via revvault export-env or set it explicitly before invoking.`,
    );
  }
  // .env files store PEM as single-line with literal \n — restore real newlines.
  return raw.replace(/\\n/g, '\n');
}

async function main(): Promise<void> {
  let parsed: ParsedCli;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    printUsage();
    process.exit(2);
  }

  let privateKey: string;
  let publicKey: string;
  try {
    privateKey = readPemEnv('REVEALUI_LICENSE_PRIVATE_KEY');
    publicKey = readPemEnv('REVEALUI_LICENSE_PUBLIC_KEY');
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(3);
  }

  try {
    const result = await issueForgeLicense(parsed.options, { privateKey, publicKey });
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${result.licenseKey}\n`);
    }
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Run main() only when invoked as a CLI (not when imported).
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
