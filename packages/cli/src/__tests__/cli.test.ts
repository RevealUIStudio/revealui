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
    expect(commandNames).toContain('shell');
  });
});
