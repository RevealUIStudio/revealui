#!/usr/bin/env tsx
/** GAP-313 preparation/posting only. Owner signs outside the observed agent session. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOwnerOverrideComment, buildOwnerOverridePayload } from './signed-override.js';

export function runSignedOverrideCli(argv: readonly string[]): number {
  try {
    const command = argv[0];
    if (command !== 'prepare' && command !== 'post')
      throw new Error(
        'usage: signed-override <prepare|post> --repo OWNER/REPO --pr N --gate NAME [flags]',
      );
    const flags = new Map<string, string>();
    const allowed = new Set([
      'repo',
      'pr',
      'gate',
      'expires',
      'out',
      'payload-file',
      'signature-file',
    ]);
    for (let i = 1; i < argv.length; i += 2) {
      const arg = argv[i] ?? '';
      const value = argv[i + 1];
      if (
        !(arg.startsWith('--') && allowed.has(arg.slice(2))) ||
        value === undefined ||
        value.startsWith('--') ||
        flags.has(arg.slice(2))
      )
        throw new Error('invalid, duplicate or unsupported flag');
      flags.set(arg.slice(2), value);
    }
    const required = (name: string): string => {
      const value = flags.get(name);
      if (!value) throw new Error(`missing --${name}`);
      return value;
    };
    const repo = required('repo');
    const prText = required('pr');
    const pr = Number(prText);
    if (String(pr) !== prText) throw new Error('invalid pull request number');
    const gate = required('gate');
    const defaultExpiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    // Validate untrusted CLI context before handing values to gh.
    buildOwnerOverridePayload(
      { repo, pr, gate, head: '0'.repeat(40) },
      flags.get('expires') ?? defaultExpiry,
    );
    const head = execFileSync(
      'gh',
      ['pr', 'view', String(pr), '--repo', repo, '--json', 'headRefOid', '--jq', '.headRefOid'],
      { encoding: 'utf8', timeout: 30000 },
    ).trim();
    if (command === 'prepare') {
      const payload = buildOwnerOverridePayload(
        { repo, pr, head, gate },
        flags.get('expires') ?? defaultExpiry,
      );
      writeFileSync(resolve(required('out')), payload, { mode: 0o600 });
      process.stdout.write(payload);
      process.stdout.write(
        'Owner signs this file in an unobserved terminal using ssh-keygen -Y sign -f OWNER_KEY -n revealfleet-override PAYLOAD_FILE. This helper never signs.\n',
      );
      return 0;
    }
    const payload = readFileSync(resolve(required('payload-file')), 'utf8');
    const expires = payload.trimEnd().slice(-10);
    if (payload !== buildOwnerOverridePayload({ repo, pr, head, gate }, expires))
      throw new Error('payload no longer matches the current pull request head/context');
    if (expires <= new Date().toISOString().slice(0, 10)) throw new Error('override expired');
    const signature = readFileSync(resolve(required('signature-file')), 'utf8');
    const comment = buildOwnerOverrideComment(payload, signature);
    execFileSync('gh', ['pr', 'comment', String(pr), '--repo', repo, '--body-file', '-'], {
      input: comment,
      encoding: 'utf8',
      timeout: 30000,
    });
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'owner override helper failed'}\n`,
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runSignedOverrideCli(process.argv.slice(2));
}
