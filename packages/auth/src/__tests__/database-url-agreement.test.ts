/**
 * The db pool, db client, auth test helper, and auth server storage must
 * resolve one URL. This file imports all four and compares them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { connectionStrings } = vi.hoisted(() => ({
  connectionStrings: [] as string[],
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor(config: { connectionString?: string }) {
      if (typeof config.connectionString === 'string') {
        connectionStrings.push(config.connectionString);
      }
    }
    on(): void {}
    end(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => ({})),
}));

import { resetDatabaseUrlConflictWarning, resolveDatabaseUrl } from '@revealui/config/database-url';
import { getClient, resetClient } from '@revealui/db/client';
import { getConnectionIdentity } from '@revealui/db/pool';
import { getStorage, resetStorage } from '../server/storage/index.js';
import { getTestDatabaseUrl } from '../utils/database.js';

const PRIMARY = 'postgresql://app:placeholder@127.0.0.1:5432/primary';
const OTHER = 'postgresql://app:placeholder@127.0.0.1:5432/other';
const LEGACY = 'postgresql://app:placeholder@127.0.0.1:5432/legacy';

const KEYS = [
  'POSTGRES_URL',
  'DATABASE_URL',
  'NEON_DATABASE_URL',
  'SUPABASE_DATABASE_URI',
  'TEST_DATABASE_URL',
  'NODE_ENV',
] as const;

let saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function apply(values: Partial<Record<(typeof KEYS)[number], string | undefined>>): void {
  for (const key of KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function expectSameUrl(expected: string): void {
  resetDatabaseUrlConflictWarning();
  connectionStrings.length = 0;
  resetClient();
  resetStorage();

  expect(resolveDatabaseUrl()).toBe(expected);
  expect(getConnectionIdentity(process.env).connectionString).toBe(expected);
  expect(getTestDatabaseUrl()).toBe(expected);

  getClient();
  getStorage();

  expect(connectionStrings.length).toBeGreaterThanOrEqual(2);
  for (const url of connectionStrings) {
    expect(url).toBe(expected);
  }
}

describe('database URL agreement', () => {
  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
    resetDatabaseUrlConflictWarning();
    connectionStrings.length = 0;
    resetClient();
    resetStorage();
  });

  afterEach(() => {
    resetClient();
    resetStorage();
    for (const key of KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetDatabaseUrlConflictWarning();
  });

  it('agrees when only POSTGRES_URL is set', () => {
    apply({ NODE_ENV: 'test', POSTGRES_URL: PRIMARY });
    expectSameUrl(PRIMARY);
  });

  it('agrees when only DATABASE_URL is set', () => {
    apply({ NODE_ENV: 'test', DATABASE_URL: OTHER });
    expectSameUrl(OTHER);
  });

  it('agrees when only the legacy SUPABASE_DATABASE_URI is set', () => {
    apply({ NODE_ENV: 'test', SUPABASE_DATABASE_URI: LEGACY });
    expectSameUrl(LEGACY);
  });

  it('agrees when both canonical names are equal', () => {
    apply({ NODE_ENV: 'test', POSTGRES_URL: PRIMARY, DATABASE_URL: PRIMARY });
    expectSameUrl(PRIMARY);
  });

  it('agrees on POSTGRES_URL and warns when the canonical names differ in development', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    try {
      apply({
        NODE_ENV: 'development',
        POSTGRES_URL: PRIMARY,
        DATABASE_URL: OTHER,
      });
      expectSameUrl(PRIMARY);
      const warning = String(warn.mock.calls[0]?.[0]);
      expect(warning).toContain('POSTGRES_URL');
      expect(warning).toContain('DATABASE_URL');
      expect(warning).not.toContain('placeholder');
      expect(warning).not.toContain('postgresql://');
    } finally {
      warn.mockRestore();
    }
  });

  it('fails closed in production for every module when the canonical names differ', () => {
    apply({
      NODE_ENV: 'production',
      POSTGRES_URL: PRIMARY,
      DATABASE_URL: OTHER,
    });

    expect(() => resolveDatabaseUrl()).toThrow('Refusing to choose');
    expect(() => getConnectionIdentity(process.env)).toThrow('Refusing to choose');
    expect(() => getTestDatabaseUrl()).toThrow('Refusing to choose');
    expect(() => getClient()).toThrow('Refusing to choose');
    expect(() => getStorage()).toThrow('Refusing to choose');
    expect(connectionStrings).toEqual([]);
  });
});
