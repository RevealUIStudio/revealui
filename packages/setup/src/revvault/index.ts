/**
 * Shared `revvault` CLI client.
 *
 * Consolidates the revvault-invocation logic that used to be hand-rolled at
 * every call site (an async `Vault` for long-lived processes like the MCP
 * OAuth provider, plus sync helpers for one-shot CLI scripts). Every caller
 * gets the same path-safety guard, the same default binary/identity
 * resolution, and the same `RevvaultError` shape.
 *
 * Two API surfaces, because the two consumer shapes are genuinely different:
 *   - {@link createRevvaultVault} — an async `Vault` (get/set/delete/list),
 *     for long-lived processes that need the full CRUD surface (e.g. the MCP
 *     OAuth provider's token storage).
 *   - {@link readRevvaultSecret} / {@link requireRevvaultSecret} /
 *     {@link writeRevvaultSecret} / {@link revvaultSecretExists} — sync
 *     one-shot lookups, for CLI scripts that read a handful of secrets and
 *     exit. Sync matches how every script call site already used
 *     `spawnSync`/`execFileSync`.
 */

import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Shared constants + errors
// ---------------------------------------------------------------------------

const DEFAULT_BIN_PATH = join(homedir(), '.local/bin/revvault');
const DEFAULT_IDENTITY_PATH = join(homedir(), '.config/age/keys.txt');
const DEFAULT_TIMEOUT_MS = 10_000;

export class RevvaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevvaultError';
  }
}

// ---------------------------------------------------------------------------
// Path safety (no-regex: explicit charset walk instead of a pattern test)
// ---------------------------------------------------------------------------

const SAFE_PATH_CHARS = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/_-.'.split(''),
);

function hasOnlySafePathChars(value: string): boolean {
  for (const char of value) {
    if (!SAFE_PATH_CHARS.has(char)) return false;
  }
  return true;
}

/** Reject shell-metacharacter and traversal patterns in vault paths. */
export function assertSafePath(path: string): void {
  if (path.length === 0) {
    throw new RevvaultError('Vault path must not be empty');
  }
  if (!hasOnlySafePathChars(path)) {
    throw new RevvaultError(`Vault path contains disallowed characters: ${path}`);
  }
  if (path.includes('..') || path.startsWith('/') || path.endsWith('/')) {
    throw new RevvaultError(`Vault path is not well-formed: ${path}`);
  }
}

/** Same rules as {@link assertSafePath} but allows the trailing slash of a prefix. */
export function assertSafePrefix(prefix: string): void {
  if (prefix.length === 0) {
    throw new RevvaultError('Vault prefix must not be empty');
  }
  if (!hasOnlySafePathChars(prefix)) {
    throw new RevvaultError(`Vault prefix contains disallowed characters: ${prefix}`);
  }
  if (prefix.includes('..') || prefix.startsWith('/')) {
    throw new RevvaultError(`Vault prefix is not well-formed: ${prefix}`);
  }
}

// ---------------------------------------------------------------------------
// Async Vault (long-lived processes, e.g. MCP OAuth token storage)
// ---------------------------------------------------------------------------

/**
 * Minimal key/value interface a caller needs from its backing store.
 *
 * Keys are revvault-style slash-delimited paths (e.g. `mcp/acme/linear/tokens`).
 * Values are opaque strings; callers JSON-encode structured values before
 * calling `set`.
 */
export interface Vault {
  /** Returns the value at `path`, or `undefined` if not present. */
  get(path: string): Promise<string | undefined>;
  /** Stores `value` at `path`, overwriting any prior value. */
  set(path: string, value: string): Promise<void>;
  /** Deletes the value at `path`. No-op if not present. */
  delete(path: string): Promise<void>;
  /**
   * Lists every path that starts with `prefix`. Returns an empty array when
   * no matches exist. The return order is implementation-defined.
   */
  list(prefix: string): Promise<string[]>;
}

export interface RevvaultVaultOptions {
  /** Path to the `revvault` binary. Defaults to `~/.local/bin/revvault`. */
  binPath?: string;
  /**
   * Age identity path. Passed via `REVVAULT_IDENTITY` env var. Defaults to
   * `~/.config/age/keys.txt`, matching revvault's own default.
   */
  identityPath?: string;
  /** Spawn timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
}

/**
 * Creates a {@link Vault} backed by the `revvault` CLI. Requires `revvault` to
 * be installed on the host and the age identity to be readable.
 *
 * Production default for RevealUI deployments. In CI or test environments
 * without revvault, prefer {@link createMemoryVault}.
 */
export function createRevvaultVault(options: RevvaultVaultOptions = {}): Vault {
  const binPath = options.binPath ?? DEFAULT_BIN_PATH;
  const identityPath =
    options.identityPath ?? process.env.REVVAULT_IDENTITY ?? DEFAULT_IDENTITY_PATH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const env = { ...process.env, REVVAULT_IDENTITY: identityPath };

  const run = (
    args: string[],
    stdin?: string,
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(binPath, args, { env, timeout: timeoutMs });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      if (stdin !== undefined) {
        child.stdin.end(stdin);
      } else {
        child.stdin.end();
      }
    });

  return {
    async get(path) {
      assertSafePath(path);
      const { code, stdout, stderr } = await run(['get', '--full', path]);
      if (code !== 0) {
        throw new RevvaultError(`revvault get exited ${code}: ${stderr.trim()}`);
      }
      if (stdout.length === 0 && stderr.toLowerCase().includes('not found')) {
        return undefined;
      }
      if (stdout.length === 0) {
        throw new RevvaultError(`revvault get returned empty output: ${stderr.trim()}`);
      }
      return stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
    },
    async set(path, value) {
      assertSafePath(path);
      const { code, stderr } = await run(['set', '--force', path], value);
      if (code !== 0) {
        throw new RevvaultError(`revvault set exited ${code}: ${stderr.trim()}`);
      }
    },
    async delete(path) {
      assertSafePath(path);
      const { code, stderr } = await run(['delete', '--force', path]);
      if (code !== 0 && !stderr.toLowerCase().includes('not found')) {
        throw new RevvaultError(`revvault delete exited ${code}: ${stderr.trim()}`);
      }
    },
    async list(prefix) {
      assertSafePrefix(prefix);
      const { code, stdout, stderr } = await run(['list', prefix]);
      if (code !== 0) {
        throw new RevvaultError(`revvault list exited ${code}: ${stderr.trim()}`);
      }
      // `revvault list` emits one path per line. Empty / informational output
      // (e.g. `No secrets found.`) returns an empty array.
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.startsWith(prefix));
    },
  };
}

/**
 * Creates an in-memory {@link Vault} backed by a `Map`. Intended for tests and
 * for short-lived processes where persistence is not required.
 *
 * An optional `seed` object prepopulates the map.
 */
export function createMemoryVault(seed?: Record<string, string>): Vault {
  const store = new Map<string, string>(seed ? Object.entries(seed) : undefined);
  return {
    async get(path) {
      return store.get(path);
    },
    async set(path, value) {
      store.set(path, value);
    },
    async delete(path) {
      store.delete(path);
    },
    async list(prefix) {
      const out: string[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) out.push(key);
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Sync one-shot lookups (CLI scripts)
// ---------------------------------------------------------------------------

export interface RevvaultLookupOptions {
  /** Path to the `revvault` binary. Defaults to `~/.local/bin/revvault`. */
  binPath?: string;
  /** Age identity path, passed via `REVVAULT_IDENTITY`. Defaults to `~/.config/age/keys.txt`. */
  identityPath?: string;
  /** Spawn timeout in ms. Defaults to 10_000. */
  timeoutMs?: number;
}

interface SyncRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runRevvaultSync(
  args: string[],
  input: string | undefined,
  options: RevvaultLookupOptions,
): SyncRunResult {
  const binPath = options.binPath ?? DEFAULT_BIN_PATH;
  const identityPath =
    options.identityPath ?? process.env.REVVAULT_IDENTITY ?? DEFAULT_IDENTITY_PATH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const env = { ...process.env, REVVAULT_IDENTITY: identityPath };

  const result = spawnSync(binPath, args, {
    env,
    encoding: 'utf-8',
    timeout: timeoutMs,
    input,
  });

  if (result.error) {
    return { code: null, stdout: '', stderr: result.error.message };
  }
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function stripTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value.slice(0, -1) : value;
}

/**
 * Reads a secret at `path`, tolerating absence. Returns `undefined` when the
 * secret is missing, the CLI is unavailable, or the lookup otherwise fails —
 * callers that must not proceed without the value should use
 * {@link requireRevvaultSecret} instead.
 */
export function readRevvaultSecret(
  path: string,
  options: RevvaultLookupOptions = {},
): string | undefined {
  assertSafePath(path);
  const { code, stdout } = runRevvaultSync(['get', '--full', path], undefined, options);
  if (code !== 0) return undefined;
  const value = stripTrailingNewline(stdout);
  return value.trim().length > 0 ? value : undefined;
}

/**
 * Reads a secret at `path`, throwing a {@link RevvaultError} naming the exact
 * path when the secret is missing (per the fleet secrets rule: a missing
 * secret must fail loud and name the path to set).
 */
export function requireRevvaultSecret(path: string, options: RevvaultLookupOptions = {}): string {
  assertSafePath(path);
  const { code, stdout, stderr } = runRevvaultSync(['get', '--full', path], undefined, options);
  const value = stripTrailingNewline(stdout);
  if (code === 0 && value.trim().length > 0) return value;
  const detail = stderr.trim().length > 0 ? stderr.trim() : 'not found';
  throw new RevvaultError(
    `Missing revvault secret at "${path}" (${detail}). Set it with: revvault set ${path}`,
  );
}

/** Writes `value` to `path` via `revvault set --force`. */
export function writeRevvaultSecret(
  path: string,
  value: string,
  options: RevvaultLookupOptions = {},
): void {
  assertSafePath(path);
  const { code, stderr } = runRevvaultSync(['set', '--force', path], value, options);
  if (code !== 0) {
    throw new RevvaultError(`revvault set exited ${code}: ${stderr.trim()}`);
  }
}

/**
 * Checks whether a value exists at `path` without reading it. Uses `revvault
 * get` (no `--full`) since the caller only needs the exit code.
 */
export function revvaultSecretExists(path: string, options: RevvaultLookupOptions = {}): boolean {
  assertSafePath(path);
  const { code } = runRevvaultSync(['get', path], undefined, options);
  return code === 0;
}
