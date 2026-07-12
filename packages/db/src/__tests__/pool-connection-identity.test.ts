/**
 * Regression tests for the pool connection identity (GAP-349 fleet scan
 * incident): with a URL set, the pool config must carry ONLY connectionString.
 * Any discrete host/port field alongside it wins over the URL parts in pg and
 * silently redirects the connection to localhost while SSL (derived from the
 * URL) stays on, producing "The server does not support SSL connections"
 * against the local dev Postgres.
 */

import { describe, expect, it } from 'vitest';
import { getConnectionIdentity } from '../pool.js';

const NEON_URL =
  'postgresql://user:pw@ep-example-123.us-east-2.aws.neon.tech/neondb?sslmode=require';

describe('getConnectionIdentity', () => {
  it('uses connectionString alone when DATABASE_URL is set', () => {
    const identity = getConnectionIdentity({ DATABASE_URL: NEON_URL });
    expect(identity).toEqual({ connectionString: NEON_URL });
    expect(Object.keys(identity)).toEqual(['connectionString']);
  });

  it('uses connectionString alone when only POSTGRES_URL is set', () => {
    const identity = getConnectionIdentity({ POSTGRES_URL: NEON_URL });
    expect(identity).toEqual({ connectionString: NEON_URL });
  });

  it('prefers DATABASE_URL over POSTGRES_URL', () => {
    const identity = getConnectionIdentity({
      DATABASE_URL: NEON_URL,
      POSTGRES_URL: 'postgresql://other@other-host:5432/other',
    });
    expect(identity.connectionString).toBe(NEON_URL);
  });

  it('never mixes discrete host fields into URL mode, even when both are set', () => {
    const identity = getConnectionIdentity({
      DATABASE_URL: NEON_URL,
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
    });
    expect(identity.host).toBeUndefined();
    expect(identity.port).toBeUndefined();
    expect(identity.connectionString).toBe(NEON_URL);
  });

  it('falls back to discrete vars with localhost defaults when no URL is set', () => {
    const identity = getConnectionIdentity({
      DATABASE_NAME: 'revealui',
      DATABASE_USER: 'postgres',
    });
    expect(identity.connectionString).toBeUndefined();
    expect(identity.host).toBe('localhost');
    expect(identity.port).toBe(5432);
    expect(identity.database).toBe('revealui');
    expect(identity.user).toBe('postgres');
  });
});
