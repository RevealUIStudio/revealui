import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLogger,
  type LogEntry,
  Logger,
  type LogLevel,
  logAudit,
  logError,
  logQuery,
} from '../logger/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLogger(overrides: ConstructorParameters<typeof Logger>[0] = {}) {
  const entries: LogEntry[] = [];
  const logger = new Logger({
    pretty: false,
    enabled: true,
    level: 'debug',
    includeTimestamp: false,
    destination: 'console',
    onLog: (e) => entries.push(e),
    ...overrides,
  });
  return { logger, entries };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('passes debug when level=debug', () => {
      const { logger, entries } = makeLogger({ level: 'debug' });
      logger.debug('d');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.level).toBe('debug');
    });

    it('filters debug when level=info', () => {
      const { logger, entries } = makeLogger({ level: 'info' });
      logger.debug('silent');
      expect(entries).toHaveLength(0);
    });

    it('passes all levels at or above configured level', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
      for (const minLevel of levels) {
        const { logger, entries } = makeLogger({ level: minLevel });
        logger.debug('d');
        logger.info('i');
        logger.warn('w');
        logger.error('e');
        logger.fatal('f');
        const passed = entries.map((e) => e.level);
        const idx = levels.indexOf(minLevel);
        expect(passed).toEqual(levels.slice(idx));
      }
    });
  });

  describe('enabled flag', () => {
    it('suppresses all output when enabled=false', () => {
      const { logger, entries } = makeLogger({ enabled: false });
      logger.info('nope');
      logger.warn('nope');
      expect(entries).toHaveLength(0);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('merges global context into every entry', () => {
      const { logger, entries } = makeLogger();
      logger.setContext({ userId: 'u1', requestId: 'r1' });
      logger.info('msg');
      expect(entries[0]?.context).toMatchObject({ userId: 'u1', requestId: 'r1' });
    });

    it('merges per-call context over global context', () => {
      const { logger, entries } = makeLogger();
      logger.setContext({ userId: 'global' });
      logger.info('msg', { userId: 'local', extra: 'x' });
      expect(entries[0]?.context).toMatchObject({ userId: 'local', extra: 'x' });
    });

    it('clearContext removes global context', () => {
      const { logger, entries } = makeLogger();
      logger.setContext({ userId: 'u1' });
      logger.clearContext();
      logger.info('msg');
      expect(entries[0]?.context?.userId).toBeUndefined();
    });
  });

  describe('error()', () => {
    it('extracts error fields into entry.error', () => {
      const { logger, entries } = makeLogger();
      const err = new Error('boom');
      logger.error('oops', err);
      expect(entries[0]?.error?.message).toBe('boom');
      expect(entries[0]?.error?.name).toBe('Error');
    });

    it('logs without error argument', () => {
      const { logger, entries } = makeLogger();
      logger.error('plain error');
      expect(entries[0]?.message).toBe('plain error');
      expect(entries[0]?.error).toBeUndefined();
    });

    it('omits stack when includeStack=false', () => {
      const { logger, entries } = makeLogger({ includeStack: false });
      logger.error('e', new Error('test'));
      expect(entries[0]?.error?.stack).toBeUndefined();
    });
  });

  describe('fatal()', () => {
    it('logs at fatal level with error info', () => {
      const { logger, entries } = makeLogger();
      logger.fatal('crash', new Error('fatal'));
      expect(entries[0]?.level).toBe('fatal');
      expect(entries[0]?.error?.message).toBe('fatal');
    });
  });

  describe('addLogHandler()', () => {
    it('calls extra handler on every log entry', () => {
      const { logger } = makeLogger();
      const extra: LogEntry[] = [];
      logger.addLogHandler((e) => extra.push(e));
      logger.info('a');
      logger.warn('b');
      expect(extra).toHaveLength(2);
      expect(extra.map((e) => e.level)).toEqual(['info', 'warn']);
    });
  });

  describe('child()', () => {
    it('inherits parent context', () => {
      const { logger } = makeLogger();
      logger.setContext({ userId: 'parent' });
      const child = logger.child({ requestId: 'req1' });
      // Child uses its own onLog  -  attach same collector
      const childEntries: LogEntry[] = [];
      child.addLogHandler((e) => childEntries.push(e));
      child.info('from child');
      expect(childEntries[0]?.context).toMatchObject({ userId: 'parent', requestId: 'req1' });
    });

    it('inherits parent extra handlers', () => {
      const { logger } = makeLogger();
      const captured: LogEntry[] = [];
      logger.addLogHandler((e) => captured.push(e));
      const child = logger.child({ service: 'child' });
      child.info('inherited');
      expect(captured).toHaveLength(1);
    });
  });

  describe('console routing', () => {
    it('routes info to console.info', () => {
      const { logger } = makeLogger();
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('routes warn to console.warn', () => {
      const { logger } = makeLogger();
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('careful');
      expect(spy).toHaveBeenCalledOnce();
    });

    it('routes error and fatal to console.error', () => {
      const { logger } = makeLogger();
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('bad');
      logger.fatal('critical');
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('timestamp', () => {
    it('includes timestamp when includeTimestamp=true', () => {
      const { logger, entries } = makeLogger({ includeTimestamp: true });
      logger.info('ts');
      expect(entries[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('omits timestamp when includeTimestamp=false', () => {
      const { logger, entries } = makeLogger({ includeTimestamp: false });
      logger.info('no-ts');
      expect(entries[0]?.timestamp).toBe('');
    });
  });

  describe('pretty formatting', () => {
    it('formats output with colors when pretty=true', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { logger } = makeLogger({ pretty: true, includeTimestamp: false });
      logger.info('pretty message');
      // Pretty output includes ANSI color codes
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('INFO');
      expect(output).toContain('pretty message');
    });

    it('formats as JSON when pretty=false', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { logger } = makeLogger({ pretty: false });
      logger.info('json message');
      const output = spy.mock.calls[0]?.[0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('includes context in pretty format', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { logger } = makeLogger({ pretty: true, includeTimestamp: false });
      logger.info('ctx', { userId: 'u123' });
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('u123');
    });

    it('includes error details in pretty format', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { logger } = makeLogger({ pretty: true, includeTimestamp: false });
      logger.error('fail', new Error('pretty error'));
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('pretty error');
    });
  });

  describe('file destination', () => {
    it('outputs JSON to console.log when destination=file', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { logger } = makeLogger({ destination: 'file', pretty: false });
      logger.info('file log');
      expect(spy).toHaveBeenCalledOnce();
      const output = spy.mock.calls[0]?.[0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('remote destination', () => {
    it('sends log to remote URL via fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      const { logger } = makeLogger({
        destination: 'remote',
        remoteUrl: 'https://logs.example.com/ingest',
      });
      logger.info('remote log');
      // Allow the async fetch to complete
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://logs.example.com/ingest',
          expect.objectContaining({ method: 'POST' }),
        );
      });
      fetchSpy.mockRestore();
    });

    it('does not fetch when remoteUrl is empty', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      const { logger } = makeLogger({ destination: 'remote', remoteUrl: '' });
      logger.info('no url');
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('falls back to console when fetch fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const { logger } = makeLogger({
        destination: 'remote',
        remoteUrl: 'https://logs.example.com/ingest',
      });
      logger.info('will fail');
      await vi.waitFor(() => {
        expect(infoSpy).toHaveBeenCalled();
      });
      infoSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe('constructor defaults', () => {
    it('defaults level to info', () => {
      const { logger, entries } = makeLogger({ level: undefined });
      // Override the makeLogger default by creating directly
      const directLogger = new Logger({});
      const directEntries: LogEntry[] = [];
      directLogger.addLogHandler((e) => directEntries.push(e));
      directLogger.debug('should be filtered');
      directLogger.info('should pass');
      expect(directEntries).toHaveLength(1);
      expect(directEntries[0]?.level).toBe('info');
      // Suppress unused warning
      void logger;
      void entries;
    });

    it('defaults enabled to true', () => {
      const directLogger = new Logger({});
      const entries: LogEntry[] = [];
      directLogger.addLogHandler((e) => entries.push(e));
      directLogger.info('should log');
      expect(entries).toHaveLength(1);
    });
  });

  describe('error with cause', () => {
    it('includes error cause in the log entry', () => {
      const { logger, entries } = makeLogger();
      const cause = new Error('root cause');
      const err = new Error('wrapper', { cause });
      logger.error('chained', err);
      expect(entries[0]?.error?.cause).toBe(cause);
    });
  });

  describe('fatal without error', () => {
    it('logs fatal level without error object', () => {
      const { logger, entries } = makeLogger();
      logger.fatal('system down');
      expect(entries[0]?.level).toBe('fatal');
      expect(entries[0]?.error).toBeUndefined();
    });
  });

  describe('multiple extra handlers', () => {
    it('calls all registered handlers', () => {
      const { logger } = makeLogger();
      const handler1: LogEntry[] = [];
      const handler2: LogEntry[] = [];
      logger.addLogHandler((e) => handler1.push(e));
      logger.addLogHandler((e) => handler2.push(e));
      logger.info('multi');
      expect(handler1).toHaveLength(1);
      expect(handler2).toHaveLength(1);
    });
  });

  describe('context accumulation', () => {
    it('setContext merges with existing context', () => {
      const { logger, entries } = makeLogger();
      logger.setContext({ userId: 'u1' });
      logger.setContext({ requestId: 'r1' });
      logger.info('merged');
      expect(entries[0]?.context).toMatchObject({ userId: 'u1', requestId: 'r1' });
    });
  });
});

// ─── Module-level helpers ─────────────────────────────────────────────────────

describe('createLogger()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns a child logger with the given context', () => {
    const child = createLogger({ service: 'test-service' });
    expect(child).toBeInstanceOf(Logger);
    // Should not throw
    child.info('from child');
  });
});

describe('logError()', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('logs the error message without throwing', () => {
    expect(() => logError(new Error('test error'))).not.toThrow();
  });
});

describe('logAudit()', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('logs audit action without throwing', () => {
    expect(() => logAudit('user.login', { userId: 'u1' })).not.toThrow();
  });
});

describe('logQuery()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('logs fast queries without a slow-query warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logQuery('SELECT 1', 50);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits a slow-query warning for queries >1000ms', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logQuery('SELECT * FROM big_table', 1500);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
