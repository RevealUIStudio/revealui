import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCli } from '../../../packages/cli/src/cli.js';
import { canonical, snapshotCommand } from '../cli-help-drift.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SNAPSHOT_PATH = path.join(ROOT, 'docs/reference/cli-help.snapshot.json');

describe('snapshotCommand', () => {
  it('captures every top-level revealui subcommand', () => {
    const snap = snapshotCommand(createCli());
    const names = snap.subcommands.map((c) => c.name).sort();
    // These are the load-bearing operational commands. Drift here should
    // be deliberate, and the snapshot file below will catch it.
    expect(names).toEqual(
      [
        'agent',
        'auth',
        'create',
        'db',
        'dev',
        'doctor',
        'migrate',
        'shell',
        'system',
        'terminal',
      ].sort(),
    );
  });

  it('sorts options within each command for deterministic output', () => {
    const snap = snapshotCommand(createCli());
    const dev = snap.subcommands.find((c) => c.name === 'dev');
    const up = dev?.subcommands.find((c) => c.name === 'up');
    expect(up).toBeDefined();
    const flags = up?.options.map((o) => o.flags) ?? [];
    const sorted = [...flags].sort((a, b) => a.localeCompare(b));
    expect(flags).toEqual(sorted);
  });

  it('captures the migrate command with its documented flags', () => {
    const snap = snapshotCommand(createCli());
    const migrate = snap.subcommands.find((c) => c.name === 'migrate');
    expect(migrate).toBeDefined();
    const flagList = migrate?.options.map((o) => o.flags).sort() ?? [];
    expect(flagList).toContain('-d, --dry-run');
    expect(flagList).toContain('--list');
    expect(flagList).toContain('--only <name>');
  });
});

describe('cli-help snapshot file', () => {
  it('exists at the committed location', () => {
    expect(fs.existsSync(SNAPSHOT_PATH)).toBe(true);
  });

  it('matches the live CLI tree (run `UPDATE=1 pnpm validate:cli-help` if this fails)', () => {
    const expected = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    const actual = canonical(snapshotCommand(createCli()));
    expect(actual).toBe(expected);
  });
});
