import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSeedDatabaseReady,
  demotePasswordlessShellDatabaseUrls,
  isAuthoritativeDatabaseUrl,
  isPasswordlessDatabaseUrl,
  isProbeDatabaseUrl,
  loadSeedEnv,
  NIX_DIRENV_DEFAULT_DB_URL,
  parseDbTarget,
  redactDatabaseUrl,
  resolveSeedDatabaseUrl,
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

describe('passwordless / authoritative URL helpers', () => {
  it('detects the nix/direnv passwordless default', () => {
    expect(isPasswordlessDatabaseUrl(NIX_DIRENV_DEFAULT_DB_URL)).toBe(true);
    expect(isPasswordlessDatabaseUrl('postgresql://postgres@localhost:5432/postgres')).toBe(true);
    expect(isPasswordlessDatabaseUrl('postgres://user:@localhost:5432/db')).toBe(true);
    expect(isPasswordlessDatabaseUrl('postgres://user:secret@localhost:5432/revealui')).toBe(false);
    expect(isPasswordlessDatabaseUrl('postgres://localhost:5432/postgres')).toBe(false);
  });

  it('treats password-bearing URLs as authoritative and passwordless as not', () => {
    expect(isAuthoritativeDatabaseUrl(undefined)).toBe(false);
    expect(isAuthoritativeDatabaseUrl('')).toBe(false);
    expect(isAuthoritativeDatabaseUrl(NIX_DIRENV_DEFAULT_DB_URL)).toBe(false);
    expect(isAuthoritativeDatabaseUrl('postgres://u:p@localhost:5432/revealui')).toBe(true);
  });

  it('demotes passwordless shell POSTGRES_URL and DATABASE_URL', () => {
    const prevPg = process.env.POSTGRES_URL;
    const prevDb = process.env.DATABASE_URL;
    try {
      process.env.POSTGRES_URL = NIX_DIRENV_DEFAULT_DB_URL;
      process.env.DATABASE_URL = NIX_DIRENV_DEFAULT_DB_URL;
      const result = demotePasswordlessShellDatabaseUrls();
      expect(result).toEqual({ demotedPostgres: true, demotedDatabase: true });
      expect(process.env.POSTGRES_URL).toBeUndefined();
      expect(process.env.DATABASE_URL).toBeUndefined();

      process.env.POSTGRES_URL = 'postgres://u:secret@localhost:5432/revealui';
      process.env.DATABASE_URL = 'postgres://u:secret@localhost:5432/revealui';
      expect(demotePasswordlessShellDatabaseUrls()).toEqual({
        demotedPostgres: false,
        demotedDatabase: false,
      });
      expect(process.env.POSTGRES_URL).toContain('secret');
    } finally {
      if (prevPg === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = prevPg;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
  });
});

describe('loadSeedEnv demotes direnv default so file credentials win', () => {
  const prevPg = process.env.POSTGRES_URL;
  const prevDb = process.env.DATABASE_URL;
  let root: string | undefined;

  afterEach(() => {
    if (prevPg === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = prevPg;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  it('lets apps/admin/.env.local replace passwordless shell defaults', () => {
    root = join(tmpdir(), `seed-env-${Date.now()}`);
    mkdirSync(join(root, 'apps/admin'), { recursive: true });
    writeFileSync(
      join(root, 'apps/admin/.env.local'),
      'POSTGRES_URL=postgres://revealui:fromfile@localhost:5432/revealui?sslmode=disable\n',
    );

    process.env.POSTGRES_URL = NIX_DIRENV_DEFAULT_DB_URL;
    process.env.DATABASE_URL = NIX_DIRENV_DEFAULT_DB_URL;

    loadSeedEnv(root, ['apps/admin/.env.local']);

    expect(resolveSeedDatabaseUrl()).toBe(
      'postgres://revealui:fromfile@localhost:5432/revealui?sslmode=disable',
    );
  });

  it('keeps an explicit password-bearing shell override over files', () => {
    root = join(tmpdir(), `seed-env-auth-${Date.now()}`);
    mkdirSync(join(root, 'apps/admin'), { recursive: true });
    writeFileSync(
      join(root, 'apps/admin/.env.local'),
      'POSTGRES_URL=postgres://revealui:fromfile@localhost:5432/revealui\n',
    );

    process.env.POSTGRES_URL = 'postgres://cli:override@127.0.0.1:5432/cli_db';
    delete process.env.DATABASE_URL;

    loadSeedEnv(root, ['apps/admin/.env.local']);

    expect(resolveSeedDatabaseUrl()).toBe('postgres://cli:override@127.0.0.1:5432/cli_db');
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
  const prevPwless = process.env.REVEALUI_ALLOW_PASSWORDLESS_DB;
  const prevPg = process.env.POSTGRES_URL;
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.REVEALUI_ALLOW_PROBE_DB;
    else process.env.REVEALUI_ALLOW_PROBE_DB = prevAllow;
    if (prevPwless === undefined) delete process.env.REVEALUI_ALLOW_PASSWORDLESS_DB;
    else process.env.REVEALUI_ALLOW_PASSWORDLESS_DB = prevPwless;
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

  it('refuses passwordless URLs with a direnv-oriented SeedEnvError', async () => {
    process.env.POSTGRES_URL = NIX_DIRENV_DEFAULT_DB_URL;
    delete process.env.REVEALUI_ALLOW_PASSWORDLESS_DB;

    await expect(
      assertSeedDatabaseReady({
        connect: async () => {
          throw new Error('should not connect');
        },
      }),
    ).rejects.toBeInstanceOf(SeedEnvError);

    await expect(
      assertSeedDatabaseReady({
        connect: async () => {
          throw new Error('should not connect');
        },
      }),
    ).rejects.toThrow(/passwordless|direnv|SCRAM|apps\/admin\/\.env\.local/i);
  });

  it('allows passwordless when REVEALUI_ALLOW_PASSWORDLESS_DB=1', async () => {
    process.env.POSTGRES_URL = NIX_DIRENV_DEFAULT_DB_URL;
    process.env.REVEALUI_ALLOW_PASSWORDLESS_DB = '1';
    let connected = false;
    const result = await assertSeedDatabaseReady({
      connect: async () => {
        connected = true;
      },
    });
    expect(connected).toBe(true);
    expect(result.target.database).toBe('postgres');
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
