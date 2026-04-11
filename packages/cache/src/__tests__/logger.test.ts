import { describe, expect, it, vi } from 'vitest';
import { configureCacheLogger, getCacheLogger } from '../logger.js';

describe('getCacheLogger', () => {
  it('returns a logger with the expected methods', () => {
    const logger = getCacheLogger();
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('returns the same logger instance on repeated calls', () => {
    const a = getCacheLogger();
    const b = getCacheLogger();
    expect(a).toBe(b);
  });
});

describe('configureCacheLogger', () => {
  it('replaces the logger returned by getCacheLogger', () => {
    const custom = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    configureCacheLogger(custom);
    const logger = getCacheLogger();

    expect(logger).toBe(custom);

    // Restore to console so other test files are not affected
    configureCacheLogger(console);
  });

  it('the replacement logger is invoked when methods are called', () => {
    const custom = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    configureCacheLogger(custom);
    const logger = getCacheLogger();

    logger.warn('test warning', { detail: 1 });
    logger.error('test error', new Error('boom'));
    logger.info('test info');
    logger.debug('test debug');

    expect(custom.warn).toHaveBeenCalledWith('test warning', { detail: 1 });
    expect(custom.error).toHaveBeenCalledWith('test error', expect.any(Error));
    expect(custom.info).toHaveBeenCalledWith('test info');
    expect(custom.debug).toHaveBeenCalledWith('test debug');

    // Restore
    configureCacheLogger(console);
  });

  it('accepts a subsequent call to replace again', () => {
    const first = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
    const second = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

    configureCacheLogger(first);
    expect(getCacheLogger()).toBe(first);

    configureCacheLogger(second);
    expect(getCacheLogger()).toBe(second);

    // Restore
    configureCacheLogger(console);
  });
});
