/**
 * Config Loader Tests
 *
 * Tests for environment detection, file loading, env merging,
 * database URL normalization, and the main loadEnvironment function.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockExistsSync = vi.fn<(path: string) => boolean>(() => false);

vi.mock('node:fs', () => ({
  existsSync: (...args: [string]) => mockExistsSync(...args),
}));

const mockDotenvConfig = vi.fn(() => ({ parsed: null }));

vi.mock('dotenv', () => ({
  config: (...args: unknown[]) => mockDotenvConfig(...(args as [{ path: string }])),
}));

// ============================================================================
// Helpers
// ============================================================================

let originalEnv: NodeJS.ProcessEnv;

function setNodeEnv(value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, 'NODE_ENV');
  } else {
    process.env.NODE_ENV = value;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('config/loader', () => {
  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockDotenvConfig.mockReturnValue({ parsed: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  // --------------------------------------------------------------------------
  // detectEnvironment
  // --------------------------------------------------------------------------

  describe('detectEnvironment()', () => {
    it('returns "production" when NODE_ENV=production', async () => {
      setNodeEnv('production');
      const { detectEnvironment } = await import('../loader.js');
      expect(detectEnvironment()).toBe('production');
    });

    it('returns "test" when NODE_ENV=test', async () => {
      setNodeEnv('test');
      const { detectEnvironment } = await import('../loader.js');
      expect(detectEnvironment()).toBe('test');
    });

    it('returns "development" when NODE_ENV=development', async () => {
      setNodeEnv('development');
      const { detectEnvironment } = await import('../loader.js');
      expect(detectEnvironment()).toBe('development');
    });

    it('returns "development" when NODE_ENV is undefined', async () => {
      setNodeEnv(undefined);
      const { detectEnvironment } = await import('../loader.js');
      expect(detectEnvironment()).toBe('development');
    });

    it('returns "development" for unknown NODE_ENV values', async () => {
      setNodeEnv('staging');
      const { detectEnvironment } = await import('../loader.js');
      expect(detectEnvironment()).toBe('development');
    });
  });

  // --------------------------------------------------------------------------
  // loadEnvFiles
  // --------------------------------------------------------------------------

  describe('loadEnvFiles()', () => {
    it('returns empty object in production (no file loading)', async () => {
      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('production');

      expect(result).toEqual({});
      expect(mockDotenvConfig).not.toHaveBeenCalled();
    });

    it('loads .env.test.local in test environment when it exists', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => typeof p === 'string' && p.endsWith('.env.test.local'),
      );
      mockDotenvConfig.mockReturnValue({ parsed: { TEST_VAR: 'from-test-local' } });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('test');

      expect(result).toEqual({ TEST_VAR: 'from-test-local' });
    });

    it('falls back to .env.test when .env.test.local does not exist', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          typeof p === 'string' && p.endsWith('.env.test') && !p.endsWith('.env.test.local'),
      );
      mockDotenvConfig.mockReturnValue({ parsed: { TEST_KEY: 'from-test' } });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('test');

      expect(result).toEqual({ TEST_KEY: 'from-test' });
    });

    it('returns empty when no test env files exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('test');

      expect(result).toEqual({});
    });

    it('loads .env.development.local in development when it exists', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => typeof p === 'string' && p.endsWith('.env.development.local'),
      );
      mockDotenvConfig.mockReturnValue({ parsed: { DEV_VAR: 'dev-local' } });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('development');

      expect(result).toEqual({ DEV_VAR: 'dev-local' });
    });

    it('falls back to .env.local when .env.development.local does not exist', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => typeof p === 'string' && p.endsWith('.env.local'),
      );
      mockDotenvConfig.mockReturnValue({ parsed: { LOCAL_VAR: 'local' } });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('development');

      expect(result).toEqual({ LOCAL_VAR: 'local' });
    });

    it('falls back to .env when no local files exist', async () => {
      // Only match the bare .env file
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p !== 'string') return false;
        return p.endsWith('/.env') || p.endsWith('\\.env');
      });
      mockDotenvConfig.mockReturnValue({ parsed: { BASE_VAR: 'base' } });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('development');

      expect(result).toEqual({ BASE_VAR: 'base' });
    });

    it('handles dotenv returning null parsed', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => typeof p === 'string' && p.endsWith('.env.test.local'),
      );
      mockDotenvConfig.mockReturnValue({ parsed: null });

      const { loadEnvFiles } = await import('../loader.js');
      const result = loadEnvFiles('test');

      expect(result).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // mergeEnvVars
  // --------------------------------------------------------------------------

  describe('mergeEnvVars()', () => {
    it('merges file vars with process env', async () => {
      const { mergeEnvVars } = await import('../loader.js');
      const result = mergeEnvVars({ FILE_KEY: 'from-file' }, {
        PROCESS_KEY: 'from-process',
      } as NodeJS.ProcessEnv);

      expect(result.FILE_KEY).toBe('from-file');
      expect(result.PROCESS_KEY).toBe('from-process');
    });

    it('process.env overrides file vars', async () => {
      const { mergeEnvVars } = await import('../loader.js');
      const result = mergeEnvVars({ SHARED: 'from-file' }, {
        SHARED: 'from-process',
      } as NodeJS.ProcessEnv);

      expect(result.SHARED).toBe('from-process');
    });

    it('excludes undefined values from file vars', async () => {
      const { mergeEnvVars } = await import('../loader.js');
      const result = mergeEnvVars({ DEFINED: 'yes' }, {
        UNDEF: undefined,
      } as unknown as NodeJS.ProcessEnv);

      expect(result.DEFINED).toBe('yes');
      expect('UNDEF' in result).toBe(false);
    });

    it('returns empty object when both inputs are empty', async () => {
      const { mergeEnvVars } = await import('../loader.js');
      const result = mergeEnvVars({}, {} as NodeJS.ProcessEnv);

      expect(result).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // normalizeDatabaseUrl
  // --------------------------------------------------------------------------

  describe('normalizeDatabaseUrl()', () => {
    it('copies DATABASE_URL to POSTGRES_URL when POSTGRES_URL is missing', async () => {
      const { normalizeDatabaseUrl } = await import('../loader.js');
      const result = normalizeDatabaseUrl({
        DATABASE_URL: 'postgres://localhost/mydb',
      });

      expect(result.POSTGRES_URL).toBe('postgres://localhost/mydb');
      expect(result.DATABASE_URL).toBe('postgres://localhost/mydb');
    });

    it('does not overwrite existing POSTGRES_URL', async () => {
      const { normalizeDatabaseUrl } = await import('../loader.js');
      const result = normalizeDatabaseUrl({
        DATABASE_URL: 'postgres://fallback/db',
        POSTGRES_URL: 'postgres://primary/db',
      });

      expect(result.POSTGRES_URL).toBe('postgres://primary/db');
    });

    it('passes through when neither URL is set', async () => {
      const { normalizeDatabaseUrl } = await import('../loader.js');
      const result = normalizeDatabaseUrl({ OTHER: 'value' });

      expect(result.POSTGRES_URL).toBeUndefined();
      expect(result.OTHER).toBe('value');
    });

    it('does not mutate the input object', async () => {
      const { normalizeDatabaseUrl } = await import('../loader.js');
      const input = { DATABASE_URL: 'postgres://localhost/db' };
      normalizeDatabaseUrl(input);

      expect(input.POSTGRES_URL).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // loadEnvironment
  // --------------------------------------------------------------------------

  describe('loadEnvironment()', () => {
    it('returns a Record<string, string>', async () => {
      setNodeEnv('test');
      const { loadEnvironment } = await import('../loader.js');
      const result = loadEnvironment();

      expect(typeof result).toBe('object');
      // Should at minimum contain NODE_ENV from process.env
      expect(result.NODE_ENV).toBe('test');
    });

    it('normalizes database URLs in the result', async () => {
      setNodeEnv('test');
      process.env.DATABASE_URL = 'postgres://localhost/testdb';
      Reflect.deleteProperty(process.env, 'POSTGRES_URL');

      const { loadEnvironment } = await import('../loader.js');
      const result = loadEnvironment();

      expect(result.POSTGRES_URL).toBe('postgres://localhost/testdb');
    });

    it('does not load files in production', async () => {
      setNodeEnv('production');

      const { loadEnvironment } = await import('../loader.js');
      loadEnvironment();

      expect(mockDotenvConfig).not.toHaveBeenCalled();
    });
  });
});
