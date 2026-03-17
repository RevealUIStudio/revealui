/**
 * Tests for the argument parser
 */

import {
  defineArgs,
  generateHelp,
  getFlag,
  type ParserConfig,
  parseArgs,
  validateRequiredArgs,
} from '@revealui/scripts/args.js';
import { describe, expect, it } from 'vitest';

describe('parseArgs', () => {
  const baseConfig: ParserConfig = {
    name: 'test-cli',
    description: 'A test CLI',
    args: [
      { name: 'json', short: 'j', type: 'boolean', description: 'JSON output' },
      { name: 'verbose', short: 'v', type: 'boolean', description: 'Verbose mode' },
      { name: 'count', short: 'c', type: 'number', description: 'Count', default: 10 },
      { name: 'name', short: 'n', type: 'string', description: 'Name' },
    ],
    commands: [
      { name: 'list', description: 'List items' },
      { name: 'get', description: 'Get item' },
      { name: 'delete', description: 'Delete item' },
    ],
  };

  describe('boolean flags', () => {
    it('parses long boolean flag', () => {
      const result = parseArgs(['--json'], baseConfig);
      expect(result.flags.json).toBe(true);
    });

    it('parses short boolean flag', () => {
      const result = parseArgs(['-j'], baseConfig);
      expect(result.flags.json).toBe(true);
    });

    it('defaults boolean to false', () => {
      const result = parseArgs([], baseConfig);
      expect(result.flags.json).toBe(false);
    });

    it('parses combined short flags', () => {
      const result = parseArgs(['-jv'], baseConfig);
      expect(result.flags.json).toBe(true);
      expect(result.flags.verbose).toBe(true);
    });

    it('parses --flag=true', () => {
      const result = parseArgs(['--json=true'], baseConfig);
      expect(result.flags.json).toBe(true);
    });

    it('parses --flag=false', () => {
      const result = parseArgs(['--json=false'], baseConfig);
      expect(result.flags.json).toBe(false);
    });
  });

  describe('string flags', () => {
    it('parses long string flag with space', () => {
      const result = parseArgs(['--name', 'test-value'], baseConfig);
      expect(result.flags.name).toBe('test-value');
    });

    it('parses long string flag with equals', () => {
      const result = parseArgs(['--name=test-value'], baseConfig);
      expect(result.flags.name).toBe('test-value');
    });

    it('parses short string flag', () => {
      const result = parseArgs(['-n', 'test-value'], baseConfig);
      expect(result.flags.name).toBe('test-value');
    });
  });

  describe('number flags', () => {
    it('parses number flag', () => {
      const result = parseArgs(['--count', '42'], baseConfig);
      expect(result.flags.count).toBe(42);
    });

    it('parses number flag with equals', () => {
      const result = parseArgs(['--count=42'], baseConfig);
      expect(result.flags.count).toBe(42);
    });

    it('uses default for number', () => {
      const result = parseArgs([], baseConfig);
      expect(result.flags.count).toBe(10);
    });

    it('throws for non-numeric value', () => {
      expect(() => parseArgs(['--count', 'abc'], baseConfig)).toThrow('must be a number');
    });
  });

  describe('commands', () => {
    it('detects command', () => {
      const result = parseArgs(['list'], baseConfig);
      expect(result.command).toBe('list');
    });

    it('detects command with flags', () => {
      const result = parseArgs(['list', '--json'], baseConfig);
      expect(result.command).toBe('list');
      expect(result.flags.json).toBe(true);
    });

    it('handles unknown command as positional', () => {
      const result = parseArgs(['unknown'], baseConfig);
      expect(result.command).toBeUndefined();
      expect(result.positional).toContain('unknown');
    });
  });

  describe('positional arguments', () => {
    it('captures positional after command', () => {
      const result = parseArgs(['get', 'item-id'], baseConfig);
      expect(result.command).toBe('get');
      expect(result.positional).toEqual(['item-id']);
    });

    it('captures multiple positional', () => {
      const result = parseArgs(['get', 'id1', 'id2'], baseConfig);
      expect(result.positional).toEqual(['id1', 'id2']);
    });
  });

  describe('help flag', () => {
    it('detects --help', () => {
      const result = parseArgs(['--help'], baseConfig);
      expect(result.help).toBe(true);
    });

    it('detects -h', () => {
      const result = parseArgs(['-h'], baseConfig);
      expect(result.help).toBe(true);
    });
  });

  describe('unknown flags', () => {
    it('stores unknown long flag as true', () => {
      const result = parseArgs(['--unknown'], baseConfig);
      expect(result.flags.unknown).toBe(true);
    });

    it('stores unknown long flag with value', () => {
      const result = parseArgs(['--unknown', 'value'], baseConfig);
      expect(result.flags.unknown).toBe('value');
    });

    it('stores unknown long flag with equals value', () => {
      const result = parseArgs(['--unknown=value'], baseConfig);
      expect(result.flags.unknown).toBe('value');
    });
  });
});

describe('defineArgs', () => {
  it('creates a parser with parse method', () => {
    const parser = defineArgs({
      name: 'test',
      description: 'Test CLI',
      args: [{ name: 'json', type: 'boolean', description: 'JSON output' }],
    });

    const result = parser.parse(['--json']);
    expect(result.flags.json).toBe(true);
  });

  it('creates a parser with generateHelp method', () => {
    const parser = defineArgs({
      name: 'test',
      description: 'Test CLI',
    });

    const help = parser.generateHelp();
    expect(help).toContain('test');
    expect(help).toContain('Test CLI');
  });
});

describe('generateHelp', () => {
  it('includes CLI name and description', () => {
    const config: ParserConfig = {
      name: 'my-cli',
      description: 'My awesome CLI',
    };

    const help = generateHelp(config);
    expect(help).toContain('my-cli');
    expect(help).toContain('My awesome CLI');
  });

  it('lists commands', () => {
    const config: ParserConfig = {
      name: 'test',
      description: 'Test',
      commands: [
        { name: 'list', description: 'List items' },
        { name: 'get', description: 'Get item' },
      ],
    };

    const help = generateHelp(config);
    expect(help).toContain('list');
    expect(help).toContain('List items');
    expect(help).toContain('get');
    expect(help).toContain('Get item');
  });

  it('lists arguments with descriptions', () => {
    const config: ParserConfig = {
      name: 'test',
      description: 'Test',
      args: [
        { name: 'json', short: 'j', type: 'boolean', description: 'Output JSON' },
        { name: 'count', type: 'number', default: 10, description: 'Item count' },
      ],
    };

    const help = generateHelp(config);
    expect(help).toContain('--json');
    expect(help).toContain('-j');
    expect(help).toContain('Output JSON');
    expect(help).toContain('--count');
    expect(help).toContain('default: 10');
  });

  it('includes built-in help option', () => {
    const help = generateHelp({ name: 'test', description: 'Test' });
    expect(help).toContain('-h, --help');
  });
});

describe('validateRequiredArgs', () => {
  it('returns valid for no required args', () => {
    const config: ParserConfig = {
      name: 'test',
      description: 'Test',
      args: [{ name: 'optional', type: 'string', description: 'Optional' }],
    };

    const args = parseArgs([], config);
    const result = validateRequiredArgs(args, config);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('returns invalid for missing required args', () => {
    const config: ParserConfig = {
      name: 'test',
      description: 'Test',
      args: [{ name: 'required', type: 'string', required: true, description: 'Required' }],
    };

    const args = parseArgs([], config);
    const result = validateRequiredArgs(args, config);

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('required');
  });

  it('returns valid when required args are provided', () => {
    const config: ParserConfig = {
      name: 'test',
      description: 'Test',
      args: [{ name: 'required', type: 'string', required: true, description: 'Required' }],
    };

    const args = parseArgs(['--required', 'value'], config);
    const result = validateRequiredArgs(args, config);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe('getFlag', () => {
  it('returns flag value when present', () => {
    const args = parseArgs(['--json'], {
      name: 'test',
      description: 'Test',
      args: [{ name: 'json', type: 'boolean', description: 'JSON' }],
    });

    expect(getFlag(args, 'json', false)).toBe(true);
  });

  it('returns default when flag not present', () => {
    const args = parseArgs([], {
      name: 'test',
      description: 'Test',
      args: [{ name: 'count', type: 'number', description: 'Count' }],
    });

    expect(getFlag(args, 'count', 42)).toBe(42);
  });
});
