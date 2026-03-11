/**
 * Logger Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../lib/logger.js';

describe('createLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with default options', () => {
    const logger = createLogger();

    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
    expect(logger.success).toBeTypeOf('function');
  });

  it('should log info messages', () => {
    const logger = createLogger({ colors: false });

    logger.info('Test message');

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
  });

  it('should log error messages', () => {
    const logger = createLogger({ colors: false });

    logger.error('Error message');

    expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
  });

  it('should log warning messages', () => {
    const logger = createLogger({ colors: false });

    logger.warn('Warning message');

    expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
    expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
  });

  it('should log success messages', () => {
    const logger = createLogger({ colors: false });

    logger.success('Success message');

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Success message'));
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[OK]'));
  });

  it('should include prefix when provided', () => {
    const logger = createLogger({ prefix: 'TestPrefix', colors: false });

    logger.info('Test message');

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[TestPrefix]'));
  });

  it('should respect log level', () => {
    const logger = createLogger({ level: 'error', colors: false });

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    // Only error should be logged
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should log nothing with silent level', () => {
    const logger = createLogger({ level: 'silent', colors: false });

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it('should log header with box formatting', () => {
    const logger = createLogger({ colors: false });

    logger.header('Test Header');

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Test Header'));
    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('='));
  });

  it('should format additional arguments', () => {
    const logger = createLogger({ colors: false });

    logger.info('Message with', { key: 'value' });

    expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('{"key":"value"}'));
  });
});
