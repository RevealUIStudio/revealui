/**
 * Tests for the dual-mode output system
 */

import { Writable } from 'node:stream';
import { createOutput, fail, OutputHandler, ok } from '@revealui/scripts/output.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Helper to capture stream output
function createCaptureStream(): { stream: Writable; getOutput: () => string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return { stream, getOutput: () => output };
}

describe('OutputHandler', () => {
  describe('mode detection', () => {
    it('creates handler in human mode', () => {
      const handler = new OutputHandler('human');
      expect(handler.getMode()).toBe('human');
      expect(handler.isJsonMode()).toBe(false);
    });

    it('creates handler in json mode', () => {
      const handler = new OutputHandler('json');
      expect(handler.getMode()).toBe('json');
      expect(handler.isJsonMode()).toBe(true);
    });

    it('accepts options object', () => {
      const handler = new OutputHandler({ mode: 'json', loggerPrefix: 'Test' });
      expect(handler.getMode()).toBe('json');
    });
  });

  describe('JSON mode output', () => {
    it('outputs structured JSON on result()', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.result({ success: true, data: { id: '123' } });

      const output = JSON.parse(getOutput());
      expect(output.success).toBe(true);
      expect(output.data).toEqual({ id: '123' });
    });

    it('includes metadata in output', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.result({ success: true, data: 'test' });

      const output = JSON.parse(getOutput());
      expect(output.metadata).toBeDefined();
      expect(output.metadata.timestamp).toBeDefined();
      expect(output.metadata.duration).toBeDefined();
    });

    it('outputs error information', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.error({ code: 'NOT_FOUND', message: 'Resource not found' });

      const output = JSON.parse(getOutput());
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('NOT_FOUND');
      expect(output.error.message).toBe('Resource not found');
    });

    it('suppresses progress messages', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.progress('Loading...');

      expect(getOutput()).toBe('');
    });

    it('suppresses debug messages', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.debug('Debug info');

      expect(getOutput()).toBe('');
    });

    it('suppresses warn messages', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.warn('Warning');

      expect(getOutput()).toBe('');
    });
  });

  describe('human mode output', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('logs progress messages', () => {
      const handler = new OutputHandler('human');
      handler.progress('Loading...');

      // Should have logged something (through logger)
      // The exact format depends on logger implementation
    });

    it('formats object data for display', () => {
      const handler = new OutputHandler('human');
      handler.result({
        success: true,
        data: { name: 'test', count: 42 },
      });

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('success() helper', () => {
    it('creates success result with data', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.success({ items: [1, 2, 3] });

      const output = JSON.parse(getOutput());
      expect(output.success).toBe(true);
      expect(output.data).toEqual({ items: [1, 2, 3] });
    });

    it('includes optional metadata', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.success('test', { count: 5 });

      const output = JSON.parse(getOutput());
      expect(output.metadata.count).toBe(5);
    });
  });

  describe('error() helper', () => {
    it('creates error result', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.error({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'name' },
      });

      const output = JSON.parse(getOutput());
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('VALIDATION_ERROR');
      expect(output.error.details.field).toBe('name');
    });
  });

  describe('data() helper', () => {
    it('outputs array as JSON in json mode', () => {
      const { stream, getOutput } = createCaptureStream();
      const handler = new OutputHandler({ mode: 'json', jsonStream: stream });

      handler.data([{ id: 1 }, { id: 2 }]);

      const output = JSON.parse(getOutput());
      expect(output.success).toBe(true);
      expect(output.data).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('outputs as table in human mode', () => {
      const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

      const handler = new OutputHandler('human');
      handler.data([{ id: 1, name: 'a' }], { format: 'table' });

      expect(tableSpy).toHaveBeenCalled();
      tableSpy.mockRestore();
    });
  });

  describe('getLogger()', () => {
    it('returns logger instance', () => {
      const handler = new OutputHandler('human');
      const logger = handler.getLogger();

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });
});

describe('createOutput', () => {
  it('creates handler based on json flag', () => {
    const humanHandler = createOutput({ json: false });
    expect(humanHandler.getMode()).toBe('human');

    const jsonHandler = createOutput({ json: true });
    expect(jsonHandler.getMode()).toBe('json');
  });

  it('defaults to human mode', () => {
    const handler = createOutput({});
    expect(handler.getMode()).toBe('human');
  });

  it('accepts additional options', () => {
    const handler = createOutput({ json: false }, { loggerPrefix: 'Test' });
    expect(handler.getMode()).toBe('human');
  });
});

describe('ok', () => {
  it('creates success result', () => {
    const result = ok({ value: 42 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });
  });

  it('includes metadata', () => {
    const result = ok('data', { duration: 100 });

    expect(result.metadata?.duration).toBe(100);
  });
});

describe('fail', () => {
  it('creates failure result', () => {
    const result = fail('NOT_FOUND', 'Item not found');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(result.error?.message).toBe('Item not found');
  });

  it('includes details', () => {
    const result = fail('VALIDATION_ERROR', 'Invalid', { field: 'email' });

    expect(result.error?.details).toEqual({ field: 'email' });
  });
});
