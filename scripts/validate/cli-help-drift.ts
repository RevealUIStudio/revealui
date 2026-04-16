/**
 * CLI Help Drift Detector
 *
 * Walks the Commander.js tree built by `@revealui/cli`'s `createCli()`
 * and compares it against a committed snapshot at
 * `docs/reference/cli-help.snapshot.json`. Fails when the two diverge
 * so CI catches silent CLI-surface changes that aren't reflected in
 * the documented reference.
 *
 * Usage:
 *   pnpm validate:cli-help          # check, exit 1 on drift
 *   UPDATE=1 pnpm validate:cli-help # regenerate the snapshot
 *
 * Exit codes:
 *   0 = snapshot matches the live CLI tree
 *   1 = drift detected (diff printed)
 *
 * The snapshot is a canonical JSON tree (sorted keys, deterministic
 * child ordering) so diffs are small and reviewable.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import { createCli } from '../../packages/cli/src/cli.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs/reference/cli-help.snapshot.json');

interface OptionSnapshot {
  flags: string;
  description: string;
  defaultValue?: unknown;
}

interface CommandSnapshot {
  name: string;
  description: string;
  aliases: string[];
  usage: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
  options: OptionSnapshot[];
  subcommands: CommandSnapshot[];
}

export function snapshotCommand(cmd: Command): CommandSnapshot {
  const args = cmd.registeredArguments.map((a) => ({
    name: a.name(),
    description: a.description,
    required: a.required,
  }));

  const options: OptionSnapshot[] = cmd.options
    .map((opt) => {
      const entry: OptionSnapshot = {
        flags: opt.flags,
        description: opt.description,
      };
      if (opt.defaultValue !== undefined) {
        entry.defaultValue = opt.defaultValue;
      }
      return entry;
    })
    .sort((a, b) => a.flags.localeCompare(b.flags));

  const subcommands = cmd.commands
    .map((c) => snapshotCommand(c))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    name: cmd.name(),
    description: cmd.description(),
    aliases: [...cmd.aliases()].sort(),
    usage: cmd.usage(),
    arguments: args,
    options,
    subcommands,
  };
}

export function canonical(obj: unknown): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

function main(): void {
  const cli = createCli();
  const actual = snapshotCommand(cli);
  const actualStr = canonical(actual);

  if (process.env.UPDATE === '1') {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, actualStr, 'utf8');
    console.log(`✓ Wrote snapshot: ${path.relative(ROOT, SNAPSHOT_PATH)}`);
    return;
  }

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(`✗ Snapshot missing: ${path.relative(ROOT, SNAPSHOT_PATH)}`);
    console.error('  Run `UPDATE=1 pnpm validate:cli-help` to create it.');
    process.exit(1);
  }

  const expected = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  if (expected === actualStr) {
    console.log('✓ CLI help snapshot matches live command tree');
    return;
  }

  console.error('✗ CLI help drift detected.');
  console.error(`  Snapshot: ${path.relative(ROOT, SNAPSHOT_PATH)}`);
  console.error('');
  console.error('  The live CLI command tree has changed — regenerate with:');
  console.error('    UPDATE=1 pnpm validate:cli-help');
  console.error('');
  console.error('  Then commit the updated snapshot alongside the CLI change.');
  console.error('  Doing so ensures every CLI-surface change lands with a');
  console.error('  reviewable diff of the user-facing command reference.');

  // Print a compact unified-ish diff of the first ~200 differing lines to
  // make review easier without pulling in a diff dependency.
  const expectedLines = expected.split('\n');
  const actualLines = actualStr.split('\n');
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  let printed = 0;
  for (let i = 0; i < maxLen && printed < 80; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      if (expectedLines[i] !== undefined) console.error(`  - ${expectedLines[i]}`);
      if (actualLines[i] !== undefined) console.error(`  + ${actualLines[i]}`);
      printed++;
    }
  }

  process.exit(1);
}

// Only run when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'cli-help-drift.ts');
if (invokedPath === selfPath) {
  main();
}
