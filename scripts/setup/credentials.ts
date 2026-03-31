#!/usr/bin/env tsx

/**
 * Machine Credentials Bootstrap
 *
 * Reads secrets from Revvault (or .env fallback) and writes them to
 * machine-level config files so CLI tools (npm, pnpm) have valid auth
 * without depending on shell env vars being loaded first.
 *
 * Run once when setting up a new machine:
 *   pnpm setup:credentials
 *
 * What it writes:
 *   ~/.npmrc  — NPM_TOKEN  (npm.org publish auth)
 *   ~/.npmrc  — NPM_TOKEN  (npm.org publish auth for Pro packages)
 *
 * Sources tried in order:
 *   1. Revvault: revealui/env/reveal-saas-dev-secrets
 *   2. .env file in project root
 *   3. Environment variables already in process.env
 *
 * @dependencies
 *   node:child_process  — spawnSync (runs revvault CLI)
 *   node:fs/promises    — read .env fallback
 *   node:os             — home dir for ~/.npmrc
 *   node:path           — path joins
 */

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Logger (inline — avoids pulling in @revealui/core/monitoring via scripts/lib)
// ---------------------------------------------------------------------------

const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  success: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.warn(`  ⚠ ${msg}`),
  error: (msg: string) => console.error(`  ✗ ${msg}`),
  header: (msg: string) => console.log(`\n── ${msg} ──\n`),
  divider: () => console.log(''),
};

// ---------------------------------------------------------------------------
// Revvault reader
// ---------------------------------------------------------------------------

const REVVAULT_BIN = join(homedir(), '.local/bin/revvault');
const REVVAULT_IDENTITY = process.env.REVVAULT_IDENTITY ?? join(homedir(), '.config/age/keys.txt');
const REVVAULT_SECRET_PATH = 'revealui/env/reveal-saas-dev-secrets';

/**
 * Parses Revvault's YAML-style `key: value` output into a plain object.
 * Mirrors the sed transformation used in .envrc: `sed 's/: /=/'`
 */
function parseRevvaultOutput(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(': ');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 2).trim();
    if (key) result[key] = value;
  }
  return result;
}

function readFromRevvault(): Record<string, string> | null {
  const result = spawnSync(REVVAULT_BIN, ['get', '--full', REVVAULT_SECRET_PATH], {
    env: { ...process.env, REVVAULT_IDENTITY },
    encoding: 'utf-8',
    timeout: 10_000,
  });

  if (result.error || result.status !== 0) return null;
  if (!result.stdout?.trim()) return null;

  return parseRevvaultOutput(result.stdout);
}

// ---------------------------------------------------------------------------
// .env fallback reader
// ---------------------------------------------------------------------------

async function getProjectRoot(): Promise<string> {
  // Walk up from __dirname to find package.json with "name": "revealui"
  let dir = new URL('..', import.meta.url).pathname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8')) as {
        name?: string;
      };
      if (pkg.name === 'revealui') return dir;
    } catch {
      // keep walking
    }
    dir = join(dir, '..');
  }
  // Fall back to two levels up from scripts/setup/
  return new URL('../..', import.meta.url).pathname;
}

async function readFromEnvFile(root: string): Promise<Record<string, string>> {
  const candidates = ['.env', '.env.local', '.env.development.local'];
  for (const filename of candidates) {
    try {
      const content = await readFile(join(root, filename), 'utf-8');
      const result: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key) result[key] = value;
      }
      return result;
    } catch {
      // try next
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// ~/.npmrc writer
// ---------------------------------------------------------------------------

const USER_NPMRC = join(homedir(), '.npmrc');

async function readNpmrc(): Promise<string> {
  try {
    return await readFile(USER_NPMRC, 'utf-8');
  } catch {
    return '';
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setNpmrcEntry(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
  const line = `${key}=${value}`;
  return pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
}

async function writeNpmToken(token: string): Promise<void> {
  let npmrc = await readNpmrc();
  npmrc = setNpmrcEntry(npmrc, '//registry.npmjs.org/:_authToken', token);
  await writeFile(USER_NPMRC, npmrc, { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log.header('RevealUI Credentials Bootstrap');

  const root = await getProjectRoot();

  // Build secrets map: process.env → .env file → Revvault (later sources win)
  log.info('Reading secrets...');
  const envFileSecrets = await readFromEnvFile(root);
  const revvaultSecrets = readFromRevvault();

  if (revvaultSecrets) {
    log.success('Revvault loaded');
  } else {
    log.warn('Revvault unavailable');
  }

  // Merge: .env provides the base, Revvault overrides (Revvault is source of truth)
  const secrets: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...envFileSecrets,
    ...(revvaultSecrets ?? {}),
  };

  log.divider();

  let wrote = 0;
  let missing = 0;

  // npm.org token
  const npmToken = secrets.NPM_TOKEN;
  if (npmToken && npmToken.length > 10) {
    await writeNpmToken(npmToken);
    log.success(`NPM_TOKEN → ~/.npmrc (//registry.npmjs.org/:_authToken)`);
    wrote++;
  } else {
    log.warn('NPM_TOKEN not found — npm publish will require `npm login`');
    log.info('  Add it to Revvault: revvault set revealui/env/reveal-saas-dev-secrets');
    missing++;
  }

  // Note: Pro packages are now on public npm (source-available open-core).
  // No GitHub Packages token needed — all @revealui packages install from registry.npmjs.org.

  log.divider();

  if (wrote > 0) {
    log.success(`${wrote} credential(s) written to ~/.npmrc (mode 600)`);
  }
  if (missing > 0) {
    log.warn(`${missing} credential(s) missing — see warnings above`);
  }
  if (wrote === 0 && missing > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
