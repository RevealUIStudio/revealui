import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../../observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  COMPRESSION_PRESETS,
  getCompressionRatio,
  getCompressionStats,
  isCompressionSupported,
} from '../compression.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRequest(headers?: Record<string, string>) {
  return new Request('http://localhost/api/test', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('compression module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompressionRatio', () => {
    it('returns 50% for half-size compression', () => {
      expect(getCompressionRatio(1000, 500)).toBe(50);
    });

    it('returns 0% for no compression', () => {
      expect(getCompressionRatio(1000, 1000)).toBe(0);
    });

    it('returns 100% for complete compression', () => {
      expect(getCompressionRatio(1000, 0)).toBe(100);
    });

    it('returns negative for expansion', () => {
      expect(getCompressionRatio(100, 200)).toBe(-100);
    });

    it('handles small sizes', () => {
      const ratio = getCompressionRatio(10, 8);
      expect(ratio).toBeCloseTo(20);
    });
  });

  describe('getCompressionStats', () => {
    it('returns correct stats for string body', () => {
      const original = 'hello world';
      const compressed = new Uint8Array([1, 2, 3, 4, 5]);

      const stats = getCompressionStats(original, compressed, 'gzip');

      expect(stats.encoding).toBe('gzip');
      expect(stats.compressedSize).toBe(5);
      expect(stats.originalSize).toBeGreaterThan(0);
      expect(stats.savings).toBe(stats.originalSize - stats.compressedSize);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('returns correct stats for Uint8Array body', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const compressed = new Uint8Array([1, 2, 3]);

      const stats = getCompressionStats(original, compressed, 'br');

      expect(stats.originalSize).toBe(10);
      expect(stats.compressedSize).toBe(3);
      expect(stats.encoding).toBe('br');
      expect(stats.compressionRatio).toBe(70);
      expect(stats.savings).toBe(7);
    });
  });

  describe('isCompressionSupported', () => {
    it('detects gzip support', () => {
      const req = createRequest({ 'accept-encoding': 'gzip, deflate' });
      const support = isCompressionSupported(req);

      expect(support.gzip).toBe(true);
      expect(support.brotli).toBe(false);
    });

    it('detects brotli support', () => {
      const req = createRequest({ 'accept-encoding': 'br, gzip' });
      const support = isCompressionSupported(req);

      expect(support.gzip).toBe(true);
      expect(support.brotli).toBe(true);
    });

    it('returns false for both when no accept-encoding', () => {
      const req = createRequest();
      const support = isCompressionSupported(req);

      expect(support.gzip).toBe(false);
      expect(support.brotli).toBe(false);
    });

    it('handles identity encoding', () => {
      const req = createRequest({ 'accept-encoding': 'identity' });
      const support = isCompressionSupported(req);

      expect(support.gzip).toBe(false);
      expect(support.brotli).toBe(false);
    });
  });

  describe('COMPRESSION_PRESETS', () => {
    it('has fast preset with lower level', () => {
      expect(COMPRESSION_PRESETS.fast.level).toBe(3);
      expect(COMPRESSION_PRESETS.fast.preferBrotli).toBe(false);
    });

    it('has balanced preset', () => {
      expect(COMPRESSION_PRESETS.balanced.level).toBe(6);
      expect(COMPRESSION_PRESETS.balanced.preferBrotli).toBe(true);
    });

    it('has max preset with highest level', () => {
      expect(COMPRESSION_PRESETS.max.level).toBe(9);
    });

    it('has api preset with excluded types', () => {
      expect(COMPRESSION_PRESETS.api.excludeTypes).toContain('image/png');
      expect(COMPRESSION_PRESETS.api.excludeTypes).toContain('application/pdf');
    });

    it('has static preset for assets', () => {
      expect(COMPRESSION_PRESETS.static.level).toBe(9);
      expect(COMPRESSION_PRESETS.static.preferBrotli).toBe(true);
    });
  });
});
