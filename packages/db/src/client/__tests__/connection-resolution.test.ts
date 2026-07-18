/**
 * Connection-resolution regression guard.
 *
 * The audit write path installs storage through `getClient()` (see
 * apps/server/src/lib/audit-storage.ts). When the audit self-test cannot reach
 * the database the server refuses to boot, so it is load-bearing that
 * `getClient()` connects to exactly the database the environment names and is
 * never silently redirected to a different one.
 *
 * These tests pin that invariant at the client layer: a set POSTGRES_URL (or
 * DATABASE_URL) is resolved verbatim into the pg pool, and `@revealui/config`
 * only ever supplies a URL it derived from those same vars (getDatabaseConfig
 * never synthesizes a default database — proven in
 * packages/config/src/__tests__/modules.test.ts). Together they guarantee the
 * resolver honors an explicit URL over any config value in every environment.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConfig, poolConstructor } = vi.hoisted(() => ({
  mockConfig: { database: undefined as { url?: string } | undefined },
  poolConstructor: vi.fn(),
}));

vi.mock('@revealui/config', () => ({ default: mockConfig }));

vi.mock('pg', () => ({
  Pool: class {
    constructor(config: { connectionString?: string }) {
      poolConstructor(config);
    }
    on(): void {}
  },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => ({})),
}));

import { getClient, resetClient } from '../index.js';

const SMOKE_URL = 'postgresql://test:test@localhost:5432/smoke';

function connectionStringOfLastPool(): string | undefined {
  const lastCall = poolConstructor.mock.calls.at(-1);
  return lastCall?.[0]?.connectionString;
}

describe('getClient connection resolution', () => {
  beforeEach(() => {
    resetClient();
    poolConstructor.mockClear();
    mockConfig.database = undefined;
    for (const key of ['POSTGRES_URL', 'DATABASE_URL'] as const) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  afterEach(() => {
    for (const key of ['POSTGRES_URL', 'DATABASE_URL'] as const) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  it('connects to the POSTGRES_URL database when config supplies no url (E2E audit path)', () => {
    // The E2E Smoke harness sets only POSTGRES_URL=.../smoke. The resolved pool
    // must target /smoke, never the pg-username default database ("test").
    process.env.POSTGRES_URL = SMOKE_URL;

    getClient();

    expect(connectionStringOfLastPool()).toBe(SMOKE_URL);
  });

  it('falls back to DATABASE_URL when POSTGRES_URL is absent', () => {
    const dbUrl = 'postgresql://test:test@localhost:5432/fallback';
    process.env.DATABASE_URL = dbUrl;

    getClient();

    expect(connectionStringOfLastPool()).toBe(dbUrl);
  });

  it('uses the config-supplied url, which is itself derived from POSTGRES_URL/DATABASE_URL', () => {
    // getDatabaseConfig returns POSTGRES_URL || DATABASE_URL || '' and never
    // synthesizes a default, so config.database.url can only ever equal the
    // URL the environment set. A set POSTGRES_URL therefore cannot be
    // overridden by a config value pointing at a different database.
    const configuredUrl = 'postgresql://test:test@localhost:5432/smoke';
    mockConfig.database = { url: configuredUrl };
    process.env.POSTGRES_URL = configuredUrl;

    getClient();

    expect(connectionStringOfLastPool()).toBe(configuredUrl);
  });

  it('throws a named error when neither config nor env provides a url', () => {
    expect(() => getClient()).toThrow('POSTGRES_URL');
  });
});
