import { describe, expect, it } from 'vitest';
import { flagBoolean, type ParsedArgs, parseArgs } from '../args.js';

function parsed(flags: ParsedArgs['flags']): ParsedArgs {
  return { positional: [], flags, help: false, raw: [] };
}

describe('flagBoolean', () => {
  it('reads kebab-case flags from ParsedArgs.flags', () => {
    expect(flagBoolean(parsed({ 'dry-run': true }), 'dry-run')).toBe(true);
    expect(flagBoolean(parsed({ 'dry-run': false }), 'dry-run')).toBe(false);
  });

  it('ignores a coincidental root property (the release.ts dry-run bug)', () => {
    const args = parsed({ 'dry-run': false });
    const root = args as unknown as Record<string, unknown>;
    root['dry-run'] = true;
    expect(flagBoolean(args, 'dry-run')).toBe(false);
    expect(Boolean(root['dry-run'])).toBe(true);
  });

  it('treats a missing flag as false', () => {
    expect(flagBoolean(parsed({}), 'no-push')).toBe(false);
  });

  it('wires parseArgs --dry-run into flagBoolean for release oss', () => {
    const args = parseArgs(['oss', '--dry-run'], {
      name: 'release',
      description: 'test',
      args: [{ name: 'dry-run', type: 'boolean', description: 'dry', default: false }],
      commands: [{ name: 'oss', description: 'oss' }],
    });
    expect(args.command).toBe('oss');
    expect(flagBoolean(args, 'dry-run')).toBe(true);
  });
});
