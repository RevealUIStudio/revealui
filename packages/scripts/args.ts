/**
 * Lightweight Argument Parser
 *
 * Type-safe argument parsing for CLI scripts with support for
 * positional args, flags, and auto-generated help text.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum and ScriptError class
 *
 * @example
 * ```typescript
 * const parser = defineArgs({
 *   name: 'workflow',
 *   description: 'Workflow management CLI',
 *   args: [
 *     { name: 'json', short: 'j', type: 'boolean', description: 'Output JSON' },
 *     { name: 'id', short: 'i', type: 'string', description: 'Workflow ID' },
 *   ],
 *   commands: ['status', 'list', 'create', 'delete'],
 * })
 *
 * const args = parseArgs(process.argv.slice(2), parser)
 * // args.command: 'status' | 'list' | ...
 * // args.flags.json: boolean
 * // args.flags.id: string | undefined
 * // args.positional: string[]
 * ```
 */

import { ErrorCode, ScriptError } from './errors.js';

// =============================================================================
// Types
// =============================================================================

export type ArgType = 'string' | 'boolean' | 'number';

export interface ArgDefinition<T extends ArgType = ArgType> {
  /** Argument name (used as --name) */
  name: string;
  /** Short flag (used as -x) */
  short?: string;
  /** Value type */
  type: T;
  /** Whether this argument is required */
  required?: boolean;
  /** Default value if not provided */
  default?: T extends 'string' ? string : T extends 'number' ? number : boolean;
  /** Description for help text */
  description: string;
}

export interface CommandDefinition {
  /** Command name */
  name: string;
  /** Command description for help text */
  description: string;
  /** Command-specific arguments */
  args?: ArgDefinition[];
}

export interface ParserConfig {
  /** CLI name for help text */
  name: string;
  /** CLI description */
  description: string;
  /** Global argument definitions */
  args?: ArgDefinition[];
  /** Available commands */
  commands?: CommandDefinition[];
  /** Positional argument names (for help text) */
  positionalNames?: string[];
}

export interface ParsedArgs {
  /** The command (first positional if matches known command) */
  command?: string;
  /** Positional arguments (after command) */
  positional: string[];
  /** Parsed flag values */
  flags: Record<string, string | number | boolean | undefined>;
  /** Whether help was requested */
  help: boolean;
  /** Raw argv for debugging */
  raw: string[];
}

export interface ArgParser {
  config: ParserConfig;
  parse: (argv: string[]) => ParsedArgs;
  generateHelp: (command?: string) => string;
}

// =============================================================================
// Parser Implementation
// =============================================================================

/**
 * Define an argument parser configuration
 */
export function defineArgs(config: ParserConfig): ArgParser {
  return {
    config,
    parse: (argv: string[]) => parseArgs(argv, config),
    generateHelp: (command?: string) => generateHelp(config, command),
  };
}

/**
 * Parse command-line arguments
 */
export function parseArgs(argv: string[], config: ParserConfig): ParsedArgs {
  const result: ParsedArgs = {
    command: undefined,
    positional: [],
    flags: {},
    help: false,
    raw: argv,
  };

  // Build lookup maps for flags
  const argsByName = new Map<string, ArgDefinition>();
  const argsByShort = new Map<string, ArgDefinition>();
  const commands = new Set(config.commands?.map((c) => c.name) ?? []);

  // Add global args
  for (const arg of config.args ?? []) {
    argsByName.set(arg.name, arg);
    if (arg.short) {
      argsByShort.set(arg.short, arg);
    }
    // Set defaults
    if (arg.default !== undefined) {
      result.flags[arg.name] = arg.default;
    } else if (arg.type === 'boolean') {
      result.flags[arg.name] = false;
    }
  }

  let i = 0;
  while (i < argv.length) {
    const token = argv[i];

    // Check for help flags
    if (token === '--help' || token === '-h') {
      result.help = true;
      i++;
      continue;
    }

    // Long flag: --name or --name=value
    if (token.startsWith('--')) {
      const eqIndex = token.indexOf('=');
      let name: string;
      let value: string | undefined;

      if (eqIndex !== -1) {
        name = token.slice(2, eqIndex);
        value = token.slice(eqIndex + 1);
      } else {
        name = token.slice(2);
      }

      const argDef = argsByName.get(name);

      if (argDef) {
        result.flags[name] = parseValue(argDef, value, argv, i);
        if (argDef.type !== 'boolean' && value === undefined) {
          i++; // Skip next token (consumed as value)
        }
      } else {
        // Unknown flag - store as string
        if (value !== undefined) {
          result.flags[name] = value;
        } else if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          result.flags[name] = argv[++i];
        } else {
          result.flags[name] = true;
        }
      }
      i++;
      continue;
    }

    // Short flag: -j or -i value
    if (token.startsWith('-') && token.length > 1) {
      const short = token.slice(1);

      // Handle combined short flags like -jv
      if (short.length > 1 && !argsByShort.has(short)) {
        for (const char of short) {
          const argDef = argsByShort.get(char);
          if (argDef && argDef.type === 'boolean') {
            result.flags[argDef.name] = true;
          }
        }
        i++;
        continue;
      }

      const argDef = argsByShort.get(short);

      if (argDef) {
        result.flags[argDef.name] = parseValue(argDef, undefined, argv, i);
        if (argDef.type !== 'boolean') {
          i++; // Skip next token (consumed as value)
        }
      } else {
        // Unknown short flag
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          result.flags[short] = argv[++i];
        } else {
          result.flags[short] = true;
        }
      }
      i++;
      continue;
    }

    // Positional argument
    if (result.command === undefined && commands.has(token)) {
      // First positional matches a command
      result.command = token;

      // Add command-specific args to lookup
      const commandDef = config.commands?.find((c) => c.name === token);
      if (commandDef?.args) {
        for (const arg of commandDef.args) {
          argsByName.set(arg.name, arg);
          if (arg.short) {
            argsByShort.set(arg.short, arg);
          }
          if (arg.default !== undefined) {
            result.flags[arg.name] = arg.default;
          } else if (arg.type === 'boolean') {
            result.flags[arg.name] = false;
          }
        }
      }
    } else {
      result.positional.push(token);
    }
    i++;
  }

  return result;
}

/**
 * Parse a value based on argument type
 */
function parseValue(
  argDef: ArgDefinition,
  inlineValue: string | undefined,
  argv: string[],
  currentIndex: number,
): string | number | boolean {
  if (argDef.type === 'boolean') {
    if (inlineValue !== undefined) {
      return inlineValue.toLowerCase() === 'true' || inlineValue === '1';
    }
    return true;
  }

  const value = inlineValue ?? argv[currentIndex + 1];

  if (value === undefined || value.startsWith('-')) {
    if (argDef.required) {
      throw new ScriptError(
        `Argument --${argDef.name} requires a value`,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    return argDef.default as string | number;
  }

  if (argDef.type === 'number') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new ScriptError(
        `Argument --${argDef.name} must be a number, got: ${value}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    return num;
  }

  return value;
}

// =============================================================================
// Help Generation
// =============================================================================

/**
 * Generate help text for the CLI
 */
export function generateHelp(config: ParserConfig, command?: string): string {
  const lines: string[] = [];

  // Header
  lines.push(config.name);
  lines.push('');
  lines.push(config.description);
  lines.push('');

  // Usage
  const positionalStr = config.positionalNames?.map((n) => `<${n}>`).join(' ') ?? '';
  if (config.commands?.length) {
    lines.push('Usage:');
    lines.push(`  ${config.name} <command> [options] ${positionalStr}`);
    lines.push('');
  } else {
    lines.push('Usage:');
    lines.push(`  ${config.name} [options] ${positionalStr}`);
    lines.push('');
  }

  // Commands
  if (config.commands?.length && !command) {
    lines.push('Commands:');
    const maxLen = Math.max(...config.commands.map((c) => c.name.length));
    for (const cmd of config.commands) {
      lines.push(`  ${cmd.name.padEnd(maxLen + 2)} ${cmd.description}`);
    }
    lines.push('');
  }

  // Command-specific help
  if (command) {
    const cmdDef = config.commands?.find((c) => c.name === command);
    if (cmdDef) {
      lines.push(`Command: ${command}`);
      lines.push(`  ${cmdDef.description}`);
      lines.push('');

      if (cmdDef.args?.length) {
        lines.push('Command Options:');
        lines.push(...formatArgs(cmdDef.args));
        lines.push('');
      }
    }
  }

  // Global options
  if (config.args?.length) {
    lines.push('Options:');
    lines.push(...formatArgs(config.args));
    lines.push('');
  }

  // Built-in options
  lines.push('  -h, --help       Show this help message');

  return lines.join('\n');
}

/**
 * Format argument definitions for help text
 */
function formatArgs(args: ArgDefinition[]): string[] {
  const lines: string[] = [];

  for (const arg of args) {
    const short = arg.short ? `-${arg.short}, ` : '    ';
    const long = `--${arg.name}`;
    const typeHint = arg.type !== 'boolean' ? ` <${arg.type}>` : '';
    const defaultHint = arg.default !== undefined ? ` (default: ${arg.default})` : '';
    const requiredHint = arg.required ? ' (required)' : '';

    lines.push(`  ${short}${long}${typeHint}${defaultHint}${requiredHint}`);
    lines.push(`        ${arg.description}`);
  }

  return lines;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate required arguments are present
 */
export function validateRequiredArgs(
  args: ParsedArgs,
  config: ParserConfig,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  const allArgs = [
    ...(config.args ?? []),
    ...(args.command ? (config.commands?.find((c) => c.name === args.command)?.args ?? []) : []),
  ];

  for (const arg of allArgs) {
    if (arg.required && args.flags[arg.name] === undefined) {
      missing.push(arg.name);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Get a typed flag value with proper narrowing
 */
export function getFlag<T extends string | number | boolean>(
  args: ParsedArgs,
  name: string,
  defaultValue: T,
): T {
  const value = args.flags[name];
  if (value === undefined) return defaultValue;
  return value as T;
}
