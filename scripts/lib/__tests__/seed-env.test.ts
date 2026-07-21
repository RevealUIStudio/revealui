import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSeedDatabaseReady,
  isProbeDatabaseUrl,
  parseDbTarget,
  redactDatabaseUrl,
  resolveSeedOwnerEmailCandidates,
  SeedEnvError,
} from '../seed-env.js';

describe('parseDbTarget / redact / probe detect', () => {
  it('parses postgres URLs without exposing password', () => {
    const target = parseDbTarget(
      'postgres://revealui:secret@localhost:5434/revealui_probe?sslmode=disable',
    );
    expect(target).toEqual({
      host: 'localhost',
      port: '5434',
      database: 'revealui_probe',
      user: 'revealui',
    });
    const redacted = redactDatabaseUrl(
      'postgres://revealui:secret@localhost:5434/revealui_probe?sslmode=disable',
    );
    expect(redacted).not.toContain('secret');
    expect(redacted).toContain('****');
  });

  it('flags the electric-latency-probe identity by port or db name', () => {
    expect(
      isProbeDatabaseUrl('postgres://revealui:x@localhost:5434/revealui_probe?sslmode=disable'),
    ).toBe(true);
    expect(isProbeDatabaseUrl('postgresql://u:p@localhost:5434/anything')).toBe(true);
    expect(isProbeDatabaseUrl('postgresql://u:p@localhost:5432/revealui_probe')).toBe(true);
    expect(isProbeDatabaseUrl('postgresql://u:p@localhost:5432/revealui')).toBe(false);
  });
});

describe('resolveSeedOwnerEmailCandidates', () => {
  const prev = process.env.REVEALUI_SEED_OWNER_EMAIL;

  afterEach(() => {
    if (prev === undefined) delete process.env.REVEALUI_SEED_OWNER_EMAIL;
    else process.env.REVEALUI_SEED_OWNER_EMAIL = prev;
  });

  it('prefers env override, then revvault, then founder default', () => {
    delete process.env.REVEALUI_SEED_OWNER_EMAIL;
    expect(resolveSeedOwnerEmailCandidates({ revvaultEmail: 'ops@example.com' })).toEqual([
      'ops@example.com',
      'founder@revealui.com',
    ]);

    process.env.REVEALUI_SEED_OWNER_EMAIL = 'seed-owner@example.com';
    expect(resolveSeedOwnerEmailCandidates({ revvaultEmail: 'ops@example.com' })).toEqual([
      'seed-owner@example.com',
      'ops@example.com',
      'founder@revealui.com',
    ]);
  });
});

describe('assertSeedDatabaseReady', () => {
  const prevAllow = process.env.REVEALUI_ALLOW_PROBE_DB;
  const prevPg = process.env.POSTGRES_URL;
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.REVEALUI_ALLOW_PROBE_DB;
    else process.env.REVEALUI_ALLOW_PROBE_DB = prevAllow;
    if (prevPg === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = prevPg;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it('refuses the probe database with a SeedEnvError', async () => {
    process.env.POSTGRES_URL =
      'postgres://revealui:x@localhost:5434/revealui_probe?sslmode=disable';
    delete process.env.REVEALUI_ALLOW_PROBE_DB;

    await expect(
      assertSeedDatabaseReady({
        connect: async () => {
          /* should not be called */
        },
      }),
    ).rejects.toBeInstanceOf(SeedEnvError);

    await expect(
      assertSeedDatabaseReady({
        connect: async () => {
          /* should not be called */
        },
      }),
    ).rejects.toThrow(/electric-latency-probe|5434|revealui_probe/);
  });

  it('allows probe when REVEALUI_ALLOW_PROBE_DB=1 and connect succeeds', async () => {
    process.env.POSTGRES_URL =
      'postgres://revealui:x@localhost:5434/revealui_probe?sslmode=disable';
    process.env.REVEALUI_ALLOW_PROBE_DB = '1';
    let connected = false;
    const result = await assertSeedDatabaseReady({
      connect: async () => {
        connected = true;
      },
    });
    expect(connected).toBe(true);
    expect(result.target.port).toBe('5434');
  });

  it('surfaces unreachable databases with host:port/db', async () => {
    process.env.POSTGRES_URL = 'postgresql://u:p@127.0.0.1:5432/revealui';
    await expect(
      assertSeedDatabaseReady({
        connect: async () => {
          throw new Error('connect ECONNREFUSED');
        },
      }),
    ).rejects.toThrow(/127\.0\.0\.1:5432\/revealui/);
  });
});
