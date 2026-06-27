import { describe, expect, it } from 'vitest';
import { createCli } from '../cli.js';

describe('cli', () => {
  it('registers the operational revealui command groups', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((command) => command.name());

    expect(commandNames).toContain('create');
    expect(commandNames).toContain('doctor');
    expect(commandNames).toContain('db');
    expect(commandNames).toContain('dev');
    expect(commandNames).toContain('migrate');
  });

  it('no longer exposes the deprecated top-level `shell` alias', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((command) => command.name());

    // Removed at #1642 — replaced by `revealui dev shell` (and `revealui dev up`).
    expect(commandNames).not.toContain('shell');
  });
});
