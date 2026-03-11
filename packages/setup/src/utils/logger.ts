/**
 * Unified Logger for RevealUI Scripts
 *
 * Provides consistent logging across all scripts with color support,
 * structured output, and log level filtering.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  colors?: boolean;
  timestamps?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

interface ColorMap {
  reset: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  cyan: string;
  magenta: string;
  dim: string;
  bold: string;
}

function getColors(enabled: boolean): ColorMap {
  if (!enabled) {
    return {
      reset: '',
      red: '',
      green: '',
      yellow: '',
      blue: '',
      cyan: '',
      magenta: '',
      dim: '',
      bold: '',
    };
  }
  return {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
  };
}

export interface Logger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  success: (msg: string, ...args: unknown[]) => void;
  warning: (msg: string, ...args: unknown[]) => void;
  header: (msg: string) => void;
  divider: () => void;
  table: (data: Record<string, unknown>[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
  progress: (current: number, total: number, label?: string) => void;
}

/**
 * Creates a logger instance with configurable options.
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: 'info', prefix: 'MyScript' })
 * logger.info('Starting process')
 * logger.success('Completed!')
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    level = (process.env.LOG_LEVEL as LogLevel) || 'info',
    prefix = '',
    colors = process.env.FORCE_COLOR !== '0' && process.stdout.isTTY !== false,
    timestamps = false,
  } = options;

  const currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  const c = getColors(colors);

  function shouldLog(msgLevel: LogLevel): boolean {
    return LOG_LEVELS[msgLevel] >= currentLevel;
  }

  function formatPrefix(): string {
    const parts: string[] = [];
    if (timestamps) {
      parts.push(`${c.dim}[${new Date().toISOString()}]${c.reset}`);
    }
    if (prefix) {
      parts.push(`${c.cyan}[${prefix}]${c.reset}`);
    }
    return parts.length > 0 ? `${parts.join(' ')} ` : '';
  }

  function formatArgs(args: unknown[]): string {
    if (args.length === 0) return '';
    return (
      ' ' +
      args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ')
    );
  }

  return {
    debug(msg: string, ...args: unknown[]) {
      if (!shouldLog('debug')) return;
      console.log(`${formatPrefix()}${c.dim}[DEBUG]${c.reset} ${msg}${formatArgs(args)}`);
    },

    info(msg: string, ...args: unknown[]) {
      if (!shouldLog('info')) return;
      console.log(`${formatPrefix()}${c.blue}[INFO]${c.reset} ${msg}${formatArgs(args)}`);
    },

    warn(msg: string, ...args: unknown[]) {
      if (!shouldLog('warn')) return;
      console.warn(`${formatPrefix()}${c.yellow}[WARN]${c.reset} ${msg}${formatArgs(args)}`);
    },

    error(msg: string, ...args: unknown[]) {
      if (!shouldLog('error')) return;
      console.error(`${formatPrefix()}${c.red}[ERROR]${c.reset} ${msg}${formatArgs(args)}`);
    },

    success(msg: string, ...args: unknown[]) {
      if (!shouldLog('info')) return;
      console.log(`${formatPrefix()}${c.green}[OK]${c.reset} ${msg}${formatArgs(args)}`);
    },

    warning(msg: string, ...args: unknown[]) {
      this.warn(msg, ...args);
    },

    header(msg: string) {
      if (!shouldLog('info')) return;
      const line = '='.repeat(msg.length + 4);
      console.log(`\n${c.cyan}${line}`);
      console.log(`| ${msg} |`);
      console.log(`${line}${c.reset}\n`);
    },

    divider() {
      if (!shouldLog('info')) return;
      console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
    },

    table(data: Record<string, unknown>[]) {
      if (!shouldLog('info')) return;
      console.table(data);
    },

    group(label: string) {
      if (!shouldLog('info')) return;
      console.group(`${c.bold}${label}${c.reset}`);
    },

    groupEnd() {
      if (!shouldLog('info')) return;
      console.groupEnd();
    },

    progress(current: number, total: number, label = '') {
      if (!shouldLog('info')) return;
      const percent = Math.round((current / total) * 100);
      const filled = Math.round(percent / 5);
      const empty = 20 - filled;
      const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
      const labelText = label ? ` ${label}` : '';
      process.stdout.write(`\r${c.cyan}${bar}${c.reset} ${percent}%${labelText}`);
      if (current === total) {
        console.log(); // New line when complete
      }
    },
  };
}

/**
 * Standardized error handler for AST parsing errors
 */
export function handleASTParseError(filePath: string, error: unknown, logger: Logger): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.warning(`AST Parse Error in ${filePath}: ${message}`);
}

/**
 * Default logger instance for quick usage
 */
export const logger = createLogger();
