#!/usr/bin/env tsx
/**
 * Owner CLI for the software-key override door.
 *
 * Passphrase comes from --passphrase-file or SIGNED_OVERRIDE_PASSPHRASE.
 * There is no TTY prompt. keygen refuses to write inside the current repo.
 *
 *   tsx scripts/gates/signed-override/cli.ts keygen --out-dir DIR --passphrase-file FILE
 *   tsx scripts/gates/signed-override/cli.ts sign --private-key PATH --expires TS ... --out FILE
 *   tsx scripts/gates/signed-override/cli.ts verify --public-key PATH --artifact FILE --repo ... --pr N --head-sha SHA --gate NAME
 *
 * verify reads expiry from the artifact. It does not take --expires.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  isPathInside,
  type OverridePayload,
  PASSPHRASE_ENV,
  parseArtifactText,
  SignedOverrideError,
  signOverride,
  verifyOverride,
  writeEncryptedKeypair,
} from './signed-override.js';

export interface CliIo {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  env: NodeJS.ProcessEnv;
  cwd: string;
}

interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string>;
  error?: string;
}

export function runSignedOverrideCli(argv: readonly string[], io?: Partial<CliIo>): number {
  const full = mergeIo(io);
  const parsed = parseFlags(argv);
  if (parsed.error !== undefined) {
    full.stderr(`${parsed.error}\n`);
    return 2;
  }
  const command = parsed.positionals[0];
  if (command === 'keygen') return cmdKeygen(parsed.flags, full);
  if (command === 'sign') return cmdSign(parsed.flags, full);
  if (command === 'verify') return cmdVerify(parsed.flags, full);
  full.stderr('usage: signed-override <keygen|sign|verify> [flags]\n');
  return 2;
}

function cmdKeygen(flags: Map<string, string>, io: CliIo): number {
  const outDirFlag = flags.get('out-dir');
  if (outDirFlag === undefined || outDirFlag.length === 0) {
    io.stderr('missing --out-dir\n');
    return 2;
  }
  const outDir = resolve(io.cwd, outDirFlag);
  if (isPathInside(io.cwd, outDir)) {
    io.stderr('refusing to write key material inside the repository\n');
    return 2;
  }
  const passphrase = readPassphrase(flags, io);
  if (passphrase instanceof SignedOverrideError) {
    io.stderr(`${passphrase.message}\n`);
    return 2;
  }
  try {
    const paths = writeEncryptedKeypair(outDir, passphrase);
    io.stdout(`private ${paths.privateKeyPath}\n`);
    io.stdout(`public ${paths.publicKeyPath}\n`);
    return 0;
  } catch (err) {
    io.stderr(`${errorMessage(err)}\n`);
    return 1;
  }
}

function cmdSign(flags: Map<string, string>, io: CliIo): number {
  const payload = readPayloadFlags(flags);
  if (typeof payload === 'string') {
    io.stderr(`${payload}\n`);
    return 2;
  }
  const privateKeyFlag = flags.get('private-key');
  const outFlag = flags.get('out');
  if (privateKeyFlag === undefined || privateKeyFlag.length === 0) {
    io.stderr('missing --private-key\n');
    return 2;
  }
  if (outFlag === undefined || outFlag.length === 0) {
    io.stderr('missing --out\n');
    return 2;
  }
  const passphrase = readPassphrase(flags, io);
  if (passphrase instanceof SignedOverrideError) {
    io.stderr(`${passphrase.message}\n`);
    return 2;
  }
  try {
    const privateKeyPem = readFileSync(resolve(io.cwd, privateKeyFlag), 'utf8');
    const blob = signOverride(payload, privateKeyPem, passphrase);
    const outPath = resolve(io.cwd, outFlag);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(blob, null, 2)}\n`, { mode: 0o644 });
    io.stdout(`artifact ${outPath}\n`);
    return 0;
  } catch (err) {
    io.stderr(`${errorMessage(err)}\n`);
    return 1;
  }
}

function cmdVerify(flags: Map<string, string>, io: CliIo): number {
  const expected = readExpectedFlags(flags);
  if (typeof expected === 'string') {
    io.stderr(`${expected}\n`);
    return 2;
  }
  const publicKeyFlag = flags.get('public-key');
  const artifactFlag = flags.get('artifact');
  if (publicKeyFlag === undefined || publicKeyFlag.length === 0) {
    io.stderr('missing --public-key\n');
    return 2;
  }
  if (artifactFlag === undefined || artifactFlag.length === 0) {
    io.stderr('missing --artifact\n');
    return 2;
  }
  let publicKeyPem: string;
  let text: string;
  try {
    publicKeyPem = readFileSync(resolve(io.cwd, publicKeyFlag), 'utf8');
    text = readFileSync(resolve(io.cwd, artifactFlag), 'utf8');
  } catch (err) {
    io.stderr(`${errorMessage(err)}\n`);
    return 1;
  }
  const blob = parseArtifactText(text);
  const verification = verifyOverride({
    blob,
    publicKeyPem,
    expected,
    now: new Date(),
  });
  if (!verification.ok) {
    io.stdout(`reject ${verification.reason ?? 'bad-artifact'}\n`);
    return 1;
  }
  io.stdout('ok\n');
  return 0;
}

function readPayloadFlags(flags: Map<string, string>): OverridePayload | string {
  const repo = requireFlag(flags, 'repo');
  if (repo instanceof MissingFlag) return repo.message;
  const prRaw = requireFlag(flags, 'pr');
  if (prRaw instanceof MissingFlag) return prRaw.message;
  const head = requireFlag(flags, 'head-sha');
  if (head instanceof MissingFlag) return head.message;
  const gate = requireFlag(flags, 'gate');
  if (gate instanceof MissingFlag) return gate.message;
  const expires = requireFlag(flags, 'expires');
  if (expires instanceof MissingFlag) return expires.message;
  const pr = parsePr(prRaw);
  if (pr === null) return 'pr must be a positive integer';
  return {
    repo,
    pr_number: pr,
    head_sha: head,
    gate_name: gate,
    expires_at: expires,
  };
}

function readExpectedFlags(
  flags: Map<string, string>,
): { repo: string; pr_number: number; head_sha: string; gate_name: string } | string {
  const repo = requireFlag(flags, 'repo');
  if (repo instanceof MissingFlag) return repo.message;
  const prRaw = requireFlag(flags, 'pr');
  if (prRaw instanceof MissingFlag) return prRaw.message;
  const head = requireFlag(flags, 'head-sha');
  if (head instanceof MissingFlag) return head.message;
  const gate = requireFlag(flags, 'gate');
  if (gate instanceof MissingFlag) return gate.message;
  const pr = parsePr(prRaw);
  if (pr === null) return 'pr must be a positive integer';
  return { repo, pr_number: pr, head_sha: head, gate_name: gate };
}

function readPassphrase(flags: Map<string, string>, io: CliIo): string | SignedOverrideError {
  const file = flags.get('passphrase-file');
  if (file !== undefined) {
    if (file.length === 0) {
      return new SignedOverrideError('passphrase-required', 'passphrase file is empty');
    }
    const text = readFileSync(resolve(io.cwd, file), 'utf8');
    const stripped = stripOneTrailingNewline(text);
    if (stripped.length === 0) {
      return new SignedOverrideError('passphrase-required', 'passphrase file is empty');
    }
    return stripped;
  }
  const fromEnv = io.env[PASSPHRASE_ENV];
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return new SignedOverrideError(
    'passphrase-required',
    `set ${PASSPHRASE_ENV} or --passphrase-file`,
  );
}

function stripOneTrailingNewline(text: string): string {
  if (text.endsWith('\r\n')) return text.slice(0, -2);
  if (text.endsWith('\n')) return text.slice(0, -1);
  return text;
}

class MissingFlag {
  readonly message: string;
  constructor(name: string) {
    this.message = `missing --${name}`;
  }
}

function requireFlag(flags: Map<string, string>, name: string): string | MissingFlag {
  const value = flags.get(name);
  if (value === undefined || value.length === 0) return new MissingFlag(name);
  return value;
}

function parsePr(raw: string): number | null {
  if (raw.length === 0 || raw.length > 10) return null;
  if (raw.startsWith('0')) return null;
  for (const ch of raw) {
    if (ch < '0' || ch > '9') return null;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseFlags(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--') {
      for (const rest of argv.slice(i + 1)) positionals.push(rest);
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      const name = arg.slice(2, eq);
      if (name.length === 0) return { positionals, flags, error: 'empty flag name' };
      flags.set(name, arg.slice(eq + 1));
      continue;
    }
    const name = arg.slice(2);
    if (name.length === 0) return { positionals, flags, error: 'empty flag name' };
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      return { positionals, flags, error: `missing value for --${name}` };
    }
    flags.set(name, next);
    i += 1;
  }
  return { positionals, flags };
}

function mergeIo(io: Partial<CliIo> | undefined): CliIo {
  return {
    stdout:
      io?.stdout ??
      ((chunk: string) => {
        process.stdout.write(chunk);
      }),
    stderr:
      io?.stderr ??
      ((chunk: string) => {
        process.stderr.write(chunk);
      }),
    env: io?.env ?? process.env,
    cwd: io?.cwd ?? process.cwd(),
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'signed override command failed';
}

function invokedAsCli(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (invokedAsCli()) {
  process.exit(runSignedOverrideCli(process.argv.slice(2)));
}
