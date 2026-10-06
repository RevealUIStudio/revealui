import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATABASE_URL_PRECEDENCE,
  DatabaseUrlConflictError,
  type DatabaseUrlEnv,
  resetDatabaseUrlConflictWarning,
  resolveDatabaseUrl,
} from '../database-url.js';
import { getDatabaseConfig } from '../modules/database.js';
import type { EnvConfig } from '../schema.js';

const PRIMARY = 'postgresql://app:supersecret@127.0.0.1:5432/primary';
const OTHER = 'postgresql://app:supersecret@127.0.0.1:5432/other';
const NEON = 'postgresql://app:supersecret@127.0.0.1:5432/neon';
const LEGACY = 'postgresql://app:supersecret@127.0.0.1:5432/legacy';

const URL_KEYS = [
  'POSTGRES_URL',
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'SUPABASE_DATABASE_URI',
] as const;

function env(values: DatabaseUrlEnv = {}): DatabaseUrlEnv {
  return { NODE_ENV: 'test', ...values };
}

function assertNoCredentials(text: string): void {
  expect(text).not.toContain('supersecret');
  expect(text).not.toContain('postgresql://');
  expect(text).not.toContain('127.0.0.1');
}

describe('resolveDatabaseUrl', () => {
  let emitWarning: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDatabaseUrlConflictWarning();
    emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    for (const key of URL_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    emitWarning.mockRestore();
    resetDatabaseUrlConflictWarning();
    for (const key of URL_KEYS) {
      delete process.env[key];
    }
  });

  it('documents POSTGRES_URL ahead of DATABASE_URL and legacy names', () => {
    expect(DATABASE_URL_PRECEDENCE).toEqual([
      'POSTGRES_URL',
      'DATABASE_URL',
      'NEON_DATABASE_URL',
      'SUPABASE_DATABASE_URI',
    ]);
  });

  it('returns POSTGRES_URL when it is the only name set', () => {
    expect(resolveDatabaseUrl(env({ POSTGRES_URL: PRIMARY }))).toBe(PRIMARY);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('returns DATABASE_URL when it is the only name set', () => {
    expect(resolveDatabaseUrl(env({ DATABASE_URL: OTHER }))).toBe(OTHER);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('returns the shared value when both canonical names are equal', () => {
    expect(resolveDatabaseUrl(env({ POSTGRES_URL: PRIMARY, DATABASE_URL: PRIMARY }))).toBe(PRIMARY);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('warns once and keeps POSTGRES_URL when the canonical names differ outside production', () => {
    const warnings: string[] = [];
    const source = env({
      NODE_ENV: 'development',
      POSTGRES_URL: PRIMARY,
      DATABASE_URL: OTHER,
    });

    expect(resolveDatabaseUrl(source, { warn: (message) => warnings.push(message) })).toBe(PRIMARY);
    expect(resolveDatabaseUrl(source, { warn: (message) => warnings.push(message) })).toBe(PRIMARY);
    expect(warnings).toHaveLength(1);
    const warning = warnings[0] ?? '';
    expect(warning).toContain('POSTGRES_URL');
    expect(warning).toContain('DATABASE_URL');
    assertNoCredentials(warning);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('emits one process warning that names variables and not URL values', () => {
    const source = env({ POSTGRES_URL: PRIMARY, DATABASE_URL: OTHER });
    expect(resolveDatabaseUrl(source)).toBe(PRIMARY);
    expect(resolveDatabaseUrl(source)).toBe(PRIMARY);
    expect(emitWarning).toHaveBeenCalledTimes(1);
    const warning = String(emitWarning.mock.calls[0]?.[0]);
    expect(warning).toContain('POSTGRES_URL');
    expect(warning).toContain('DATABASE_URL');
    assertNoCredentials(warning);

    resetDatabaseUrlConflictWarning();
    resolveDatabaseUrl(source);
    expect(emitWarning).toHaveBeenCalledTimes(2);
  });

  it('throws in production when the canonical names differ and does not include URL values', () => {
    const source = env({
      NODE_ENV: 'production',
      POSTGRES_URL: PRIMARY,
      DATABASE_URL: OTHER,
    });
    expect(() => resolveDatabaseUrl(source)).toThrow(DatabaseUrlConflictError);
    try {
      resolveDatabaseUrl(source);
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseUrlConflictError);
      const message = error instanceof Error ? error.message : '';
      expect(message).toContain('POSTGRES_URL');
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('Refusing to choose');
      assertNoCredentials(message);
      if (error instanceof DatabaseUrlConflictError) {
        expect(error.variableNames).toEqual(['POSTGRES_URL', 'DATABASE_URL']);
      }
    }
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('lets an explicit nodeEnv override the env object', () => {
    const source = env({ POSTGRES_URL: PRIMARY, DATABASE_URL: OTHER });
    expect(() => resolveDatabaseUrl(source, { nodeEnv: 'production' })).toThrow(
      DatabaseUrlConflictError,
    );
  });

  it('treats an empty string as unset and falls through', () => {
    expect(resolveDatabaseUrl(env({ POSTGRES_URL: '', DATABASE_URL: OTHER }))).toBe(OTHER);
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it('uses NEON_DATABASE_URL only after both canonical names are empty', () => {
    expect(
      resolveDatabaseUrl(
        env({
          POSTGRES_URL: PRIMARY,
          NEON_DATABASE_URL: NEON,
          SUPABASE_DATABASE_URI: LEGACY,
        }),
      ),
    ).toBe(PRIMARY);
    expect(
      resolveDatabaseUrl(
        env({
          DATABASE_URL: OTHER,
          NEON_DATABASE_URL: NEON,
        }),
      ),
    ).toBe(OTHER);
    expect(
      resolveDatabaseUrl(env({ NEON_DATABASE_URL: NEON, SUPABASE_DATABASE_URI: LEGACY })),
    ).toBe(NEON);
  });

  it('uses SUPABASE_DATABASE_URI when every earlier name is empty', () => {
    expect(resolveDatabaseUrl(env({ SUPABASE_DATABASE_URI: LEGACY }))).toBe(LEGACY);
    expect(resolveDatabaseUrl(env())).toBeUndefined();
  });

  it('reads process.env by default', () => {
    process.env.POSTGRES_URL = PRIMARY;
    expect(resolveDatabaseUrl()).toBe(PRIMARY);
  });

  it('getDatabaseConfig returns the same url', () => {
    const source = env({ POSTGRES_URL: PRIMARY, DATABASE_URL: PRIMARY });
    expect(getDatabaseConfig(source as EnvConfig).url).toBe(resolveDatabaseUrl(source));
    expect(getDatabaseConfig(source as EnvConfig).connectionString).toBe(PRIMARY);
  });
});
