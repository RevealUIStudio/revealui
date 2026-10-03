import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertSeedDatabaseReady,
  isProbeDatabaseUrl,
  loadSeedEnv,
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

describe('loadSeedEnv preserves the selected database target', () => {
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

  function conflictingFile(): string {
    root = mkdtempSync(join(tmpdir(), 'seed-target-'));
    mkdirSync(join(root, 'apps/admin'), { recursive: true });
    writeFileSync(
      join(root, 'apps/admin/.env.local'),
      'POSTGRES_URL=postgresql://file:file-password@file.invalid/file_db\nDATABASE_URL=postgresql://file.invalid/alias_db\n',
    );
    return root;
  }

  it.each([
    'postgresql://selected@selected.invalid/chosen',
    'postgresql://selected:@selected.invalid/chosen',
    'postgresql://selected:private-password@selected.invalid/chosen',
  ])('keeps the caller POSTGRES_URL over conflicting files: %s', (selected) => {
    process.env.POSTGRES_URL = selected;
    delete process.env.DATABASE_URL;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(resolveSeedDatabaseUrl()).toBe(selected);
  });

  it('promotes caller DATABASE_URL before a file can provide POSTGRES_URL', () => {
    delete process.env.POSTGRES_URL;
    const selected = 'postgresql://selected@selected.invalid/chosen';
    process.env.DATABASE_URL = selected;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(process.env.POSTGRES_URL).toBe(selected);
    expect(resolveSeedDatabaseUrl()).toBe(selected);
  });

  it('prefers caller POSTGRES_URL when both caller keys are set', () => {
    process.env.POSTGRES_URL = 'postgresql://primary.invalid/chosen';
    process.env.DATABASE_URL = 'postgresql://alias.invalid/other';
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(resolveSeedDatabaseUrl()).toBe('postgresql://primary.invalid/chosen');
  });

  it('loads the configured file when neither caller URL is set', () => {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(resolveSeedDatabaseUrl()).toBe('postgresql://file:file-password@file.invalid/file_db');
  });

  it.each(['POSTGRES_URL', 'DATABASE_URL', 'both'])('treats empty %s as absent', (key) => {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    if (key === 'POSTGRES_URL' || key === 'both') process.env.POSTGRES_URL = '';
    if (key === 'DATABASE_URL' || key === 'both') process.env.DATABASE_URL = '';
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(resolveSeedDatabaseUrl()).toBe('postgresql://file:file-password@file.invalid/file_db');
  });

  it('preserves caller DATABASE_URL when caller POSTGRES_URL is empty', () => {
    process.env.POSTGRES_URL = '';
    const selected = 'postgresql://selected@selected.invalid/chosen';
    process.env.DATABASE_URL = selected;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    expect(resolveSeedDatabaseUrl()).toBe(selected);
  });

  it('passes the exact preserved passwordless target to the existing connector', async () => {
    const selected = 'postgresql://selected@selected.invalid/chosen?sslmode=require';
    delete process.env.POSTGRES_URL;
    process.env.DATABASE_URL = selected;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: selected });
    expect(connect).toHaveBeenCalledExactlyOnceWith(selected);
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

  it('accepts passwordless trust authentication when the connector succeeds', async () => {
    const selected = 'postgresql://selected@selected.invalid/chosen';
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: selected });
    expect(connect).toHaveBeenCalledExactlyOnceWith(selected);
  });

  it.each([
    'postgresql://selected@selected.invalid/chosen',
    'postgresql://selected:private-password@selected.invalid/chosen',
  ])(
    'fails closed on authentication failure without exposing driver credentials: %s',
    async (selected) => {
      process.env.POSTGRES_URL = selected;
      const connect = vi
        .fn()
        .mockRejectedValue(new Error(`authentication failed for ${selected}: private-password`));
      const failure = await assertSeedDatabaseReady({ connect }).catch((error: unknown) => error);
      expect(connect).toHaveBeenCalledExactlyOnceWith(selected);
      expect(failure).toBeInstanceOf(SeedEnvError);
      expect((failure as Error).message).toContain('selected.invalid:5432/chosen');
      expect((failure as Error).message).not.toContain('private-password');
    },
  );

  it.each([
    'https://selected.invalid/chosen?password=private-password',
    'postgresql://selected.invalid/',
    'postgresql:///chosen',
    'postgresql://selected.invalid/chosen?host=other.invalid',
    'postgresql://selected.invalid/chosen?%68ost=other.invalid',
    'postgresql://selected.invalid/chosen?%70ort=5434',
    'invalid-private-password',
  ])('refuses invalid or ambiguous targets before connecting: %s', async (selected) => {
    process.env.POSTGRES_URL = selected;
    process.env.DATABASE_URL = 'postgresql://fallback.invalid/other';
    const connect = vi.fn().mockResolvedValue(undefined);
    const failure = await assertSeedDatabaseReady({ connect }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SeedEnvError);
    expect(connect).not.toHaveBeenCalled();
    expect((failure as Error).message).not.toContain('private-password');
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

  it('preserves supported non-routing query options for the connector', async () => {
    const selected =
      'postgresql://selected@selected.invalid/chosen?sslmode=require&application_name=seed';
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: selected });
    expect(connect).toHaveBeenCalledExactlyOnceWith(selected);
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

describe('seed launch contract', () => {
  it('leaves database configuration loading to the shared seed loader', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    for (const name of ['admin', 'fleet-marketing', 'fleet-marketing-home', 'billing']) {
      expect(manifest.scripts[`db:seed:${name}`]).not.toMatch(/\bdotenv\b/);
    }
  });
});
