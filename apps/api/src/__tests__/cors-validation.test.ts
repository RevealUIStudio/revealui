/**
 * CORS Validation Test - Production Blocker #2 Verification
 *
 * Verifies that CORS configuration is properly validated:
 * 1. Uses CORS_ORIGIN env var when set
 * 2. Falls back to hardcoded production origins when CORS_ORIGIN is missing
 * 3. Falls back to localhost origins in development
 * 4. Logs warnings when falling back to hardcoded origins
 *
 * @see docs/PRODUCTION_BLOCKERS.md - Critical Fix #2
 */

import { logger } from '@revealui/core/observability/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCorsOrigins } from '../index.js';

const HARDCODED_PRODUCTION_ORIGINS = [
  'https://cms.revealui.com',
  'https://revealui.com',
  'https://www.revealui.com',
  'https://marketing.revealui.com',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4000',
  'http://localhost:5173',
];

describe('Critical Fix #2: CORS Validation', () => {
  let originalNodeEnv: string | undefined;
  let originalCorsOrigin: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalCorsOrigin = process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGIN = originalCorsOrigin;
    vi.restoreAllMocks();
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('falls back to hardcoded origins when CORS_ORIGIN is not set', () => {
      delete process.env.CORS_ORIGIN;

      expect(getCorsOrigins()).toEqual(HARDCODED_PRODUCTION_ORIGINS);
    });

    it('falls back to hardcoded origins when CORS_ORIGIN is empty string', () => {
      process.env.CORS_ORIGIN = '';

      expect(getCorsOrigins()).toEqual(HARDCODED_PRODUCTION_ORIGINS);
    });

    it('falls back to hardcoded origins when CORS_ORIGIN contains only whitespace', () => {
      process.env.CORS_ORIGIN = '   ,  ,   ';

      expect(getCorsOrigins()).toEqual(HARDCODED_PRODUCTION_ORIGINS);
    });

    it('falls back to hardcoded origins when CORS_ORIGIN has only commas', () => {
      process.env.CORS_ORIGIN = ',,,';

      expect(getCorsOrigins()).toEqual(HARDCODED_PRODUCTION_ORIGINS);
    });

    it('accepts valid single origin', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com';

      const origins = getCorsOrigins();
      expect(origins).toEqual(['https://app.example.com']);
    });

    it('accepts valid comma-separated origins', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com,https://www.example.com';

      const origins = getCorsOrigins();
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com']);
    });

    it('accepts origins with whitespace (trimmed)', () => {
      process.env.CORS_ORIGIN = ' https://app.example.com , https://www.example.com ';

      const origins = getCorsOrigins();
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com']);
    });

    it('filters out empty strings from comma-separated list', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com, , ,https://www.example.com';

      const origins = getCorsOrigins();
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com']);
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('allows missing CORS_ORIGIN in development', () => {
      delete process.env.CORS_ORIGIN;

      const origins = getCorsOrigins();
      expect(origins).toEqual(DEV_ORIGINS);
    });

    it('uses localhost origins by default in development', () => {
      delete process.env.CORS_ORIGIN;

      const origins = getCorsOrigins();
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://localhost:4000');
      expect(origins.length).toBe(4);
    });
  });

  describe('Vercel Preview Deployments', () => {
    let originalVercelEnv: string | undefined;

    beforeEach(() => {
      originalVercelEnv = process.env.VERCEL_ENV;
    });

    afterEach(() => {
      if (originalVercelEnv === undefined) {
        delete process.env.VERCEL_ENV;
      } else {
        process.env.VERCEL_ENV = originalVercelEnv;
      }
    });

    it('does not allow Vercel preview origins in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.CORS_ORIGIN = 'https://cms.revealui.com';
      process.env.VERCEL_ENV = 'production';

      // getCorsOrigins only returns the static list — preview matching
      // happens in the CORS middleware origin callback, not here
      const origins = getCorsOrigins();
      expect(origins).toEqual(['https://cms.revealui.com']);
      expect(origins).not.toContain('https://my-app-abc123.vercel.app');
    });
  });

  describe('Warn Behavior (no throw)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN;
    });

    it('does not throw — returns fallback origins to allow cold-start health checks', () => {
      vi.spyOn(logger, 'warn').mockImplementation(() => {});
      expect(() => getCorsOrigins()).not.toThrow();
      expect(getCorsOrigins()).toEqual(HARDCODED_PRODUCTION_ORIGINS);
    });

    it('warn message explains that CORS_ORIGIN env var is missing', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      getCorsOrigins();
      const message = warnSpy.mock.calls[0]?.[0] as string;
      expect(message).toContain('CORS_ORIGIN');
    });

    it('warn message references hardcoded fallback', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      getCorsOrigins();
      const message = warnSpy.mock.calls[0]?.[0] as string;
      expect(message).toContain('hardcoded fallback');
    });
  });
});

/**
 * Success Criteria:
 * ✅ All tests passing = CORS validation prevents production misconfigurations
 * ❌ Any test failing = Critical regression requiring immediate fix
 *
 * What This Verifies:
 * 1. Production with CORS_ORIGIN: uses env var values
 * 2. Production without CORS_ORIGIN: falls back to hardcoded origins (never empty)
 * 3. Development: Works without CORS_ORIGIN (uses localhost)
 * 4. Edge cases: Empty strings, whitespace, commas trigger fallback
 * 5. Function never throws — allows health checks to respond on misconfigured deploys
 */
