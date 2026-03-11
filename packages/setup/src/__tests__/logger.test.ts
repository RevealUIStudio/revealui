import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger, handleASTParseError } from '../utils/logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('creates a logger with all methods', () => {
    const logger = createLogger({ level: 'silent' });
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.success).toBe('function');
    expect(typeof logger.warning).toBe('function');
    expect(typeof logger.header).toBe('function');
    expect(typeof logger.divider).toBe('function');
    expect(typeof logger.table).toBe('function');
    expect(typeof logger.group).toBe('function');
    expect(typeof logger.groupEnd).toBe('function');
    expect(typeof logger.progress).toBe('function');
  });

  describe('log level filtering', () => {
    it('does not log debug messages at info level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.debug('should not appear');
      expect(spy).not.toHaveBeenCalled();
    });

    it('logs info messages at info level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.info('hello');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain('hello');
    });

    it('logs debug messages at debug level', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'debug', colors: false });
      logger.debug('debug msg');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain('debug msg');
    });

    it('suppresses all output at silent level', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger({ level: 'silent', colors: false });
      logger.debug('nope');
      logger.info('nope');
      logger.warn('nope');
      logger.error('nope');
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('warn level suppresses info and debug', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = createLogger({ level: 'warn', colors: false });
      logger.debug('nope');
      logger.info('nope');
      logger.success('nope');
      expect(console.log).not.toHaveBeenCalled();
      logger.warn('yes');
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('prefix', () => {
    it('includes prefix in output', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ prefix: 'MyApp', colors: false });
      logger.info('test');
      expect(spy.mock.calls[0]?.[0]).toContain('[MyApp]');
    });

    it('omits prefix tag when not specified', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ colors: false });
      logger.info('test');
      expect(spy.mock.calls[0]?.[0]).not.toContain('[MyApp]');
      expect(spy.mock.calls[0]?.[0]).toContain('[INFO]');
    });
  });

  describe('success', () => {
    it('outputs success message with [OK] tag', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.success('done');
      expect(spy).toHaveBeenCalled();
      const output = spy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[OK]');
      expect(output).toContain('done');
    });
  });

  describe('warning alias', () => {
    it('delegates to warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = createLogger({ level: 'warn', colors: false });
      logger.warning('alert');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toContain('alert');
    });
  });

  describe('header', () => {
    it('prints a bordered header', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.header('Setup');
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('divider', () => {
    it('prints a horizontal line', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.divider();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('table', () => {
    it('calls console.table', () => {
      const spy = vi.spyOn(console, 'table').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      const data = [{ name: 'a', value: 1 }];
      logger.table(data);
      expect(spy).toHaveBeenCalledWith(data);
    });
  });

  describe('group and groupEnd', () => {
    it('calls console.group and console.groupEnd', () => {
      const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.group('My Group');
      logger.groupEnd();
      expect(groupSpy).toHaveBeenCalledTimes(1);
      expect(groupEndSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress', () => {
    it('writes progress bar to stdout', () => {
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logger = createLogger({ level: 'info', colors: false });
      logger.progress(5, 10, 'loading');
      expect(spy).toHaveBeenCalledTimes(1);
      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('50%');
      expect(output).toContain('loading');
    });

    it('prints newline when complete', () => {
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.progress(10, 10);
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('formatArgs', () => {
    it('formats object arguments as JSON', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.info('msg', { key: 'value' });
      expect(spy.mock.calls[0]?.[0]).toContain('{"key":"value"}');
    });

    it('formats string arguments as-is', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createLogger({ level: 'info', colors: false });
      logger.info('msg', 'extra');
      expect(spy.mock.calls[0]?.[0]).toContain('extra');
    });
  });
});

describe('handleASTParseError', () => {
  it('logs a warning with file path and error message', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ level: 'warn', colors: false });
    handleASTParseError('/some/file.ts', new Error('Unexpected token'), logger);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain('/some/file.ts');
    expect(spy.mock.calls[0]?.[0]).toContain('Unexpected token');
  });

  it('handles non-Error objects', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ level: 'warn', colors: false });
    handleASTParseError('/some/file.ts', 'string error', logger);
    expect(spy.mock.calls[0]?.[0]).toContain('string error');
  });
});
