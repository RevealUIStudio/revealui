import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(isProbeDatabaseUrl('postgresql://u:p@localhost:5432/%72evealui_probe')).toBe(true);
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

  it('binds the preserved passwordless target before the existing connector', async () => {
    const selected = 'postgresql://selected@selected.invalid/chosen?sslmode=require';
    const bound = 'postgresql://selected@selected.invalid:5432/chosen?sslmode=require';
    delete process.env.POSTGRES_URL;
    process.env.DATABASE_URL = selected;
    loadSeedEnv(conflictingFile(), ['apps/admin/.env.local']);
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: bound });
    expect(connect).toHaveBeenCalledExactlyOnceWith(bound);
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

describe('seed preflight and writes share the driver target', () => {
  let root: string;

  beforeEach(() => {
    for (const key of [
      'POSTGRES_URL',
      'DATABASE_URL',
      'PGHOST',
      'PGPORT',
      'PGDATABASE',
      'PGUSER',
      'PGPASSWORD',
    ]) {
      vi.stubEnv(key, undefined);
    }
    root = mkdtempSync(join(tmpdir(), 'seed-routing-'));
    writeFileSync(
      join(root, 'conflicting.env'),
      [
        'POSTGRES_URL=postgresql://file@file.invalid/file_db',
        'DATABASE_URL=postgresql://alias@alias.invalid/alias_db',
        'PGHOST=probe.invalid',
        'PGPORT=5434',
        'PGDATABASE=revealui_probe',
        'PGUSER=other-user',
        'PGPASSWORD=file-password',
      ].join('\n'),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['POSTGRES_URL', 'DATABASE_URL', 'both'])(
    'binds an omitted port before preflight and later dotenv reload: %s',
    async (key) => {
      const selected = 'postgresql://selected:chosen-password@selected.invalid/chosen';
      const bound = 'postgresql://selected:chosen-password@selected.invalid:5432/chosen';
      if (key !== 'DATABASE_URL') process.env.POSTGRES_URL = selected;
      if (key !== 'POSTGRES_URL') process.env.DATABASE_URL = selected;
      if (key === 'both') process.env.DATABASE_URL = 'postgresql://other.invalid/other';
      loadSeedEnv(root, ['conflicting.env']);
      let preflight: pg.Client | undefined;
      let preflightAliases: Array<string | undefined> = [];
      const ready = await assertSeedDatabaseReady({
        connect: async (url) => {
          preflight = new pg.Client({ connectionString: url });
          preflightAliases = [process.env.POSTGRES_URL, process.env.DATABASE_URL];
        },
      });
      const identity = {
        host: ready.target.host,
        port: Number(ready.target.port),
        database: ready.target.database,
        user: ready.target.user,
        password: 'chosen-password',
      };
      const preflightPort = (preflight as unknown as { connectionParameters: { port: number } })
        .connectionParameters.port;
      expect(preflightPort).toBe(Number(ready.target.port));
      expect(preflight).toMatchObject({ connectionParameters: identity });
      expect(preflightAliases).toEqual([bound, bound]);
      expect(ready.url).toBe(bound);
      expect(ready.target).toEqual({
        host: 'selected.invalid',
        port: '5432',
        database: 'chosen',
        user: 'selected',
      });
      // Config's lazy dotenv loading can restore missing PG* keys. The selected
      // URI itself must remain authoritative without deleting those keys.
      for (const envKey of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
        delete process.env[envKey];
      }
      loadDotenv({ path: join(root, 'conflicting.env'), override: false });
      expect(process.env.PGPORT).toBe('5434');
      for (const url of [process.env.POSTGRES_URL, process.env.DATABASE_URL]) {
        const writer = new pg.Client({ connectionString: url });
        expect(preflight).toMatchObject({ connectionParameters: identity });
        expect(writer).toMatchObject({ connectionParameters: identity });
      }
    },
  );

  it.each([
    'postgres://selected@selected.invalid:5432/chosen?sslmode=verify-full',
    'postgresql://selected:@selected.invalid:5432/chosen?application_name=seed',
  ])('preserves an explicit passwordless URL byte-for-byte: %s', async (selected) => {
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: selected });
    expect(connect).toHaveBeenCalledExactlyOnceWith(selected);
    expect(process.env.POSTGRES_URL).toBe(selected);
    expect(process.env.DATABASE_URL).toBe(selected);
  });

  it('preserves encoded identity and non-routing options when binding the port', async () => {
    const selected =
      'postgresql://selected:p%20ass%25word@selected.invalid/chosen%20db?sslmode=verify-full&application_name=seed%20job&options=-c%20statement_timeout%3D5000';
    const bound = selected.replace('selected.invalid/', 'selected.invalid:5432/');
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    const ready = await assertSeedDatabaseReady({ connect });
    expect(ready.url).toBe(bound);
    expect(connect).toHaveBeenCalledExactlyOnceWith(bound);
    expect(process.env.DATABASE_URL).toBe(bound);
    expect(new pg.Client({ connectionString: ready.url })).toMatchObject({
      connectionParameters: {
        host: 'selected.invalid',
        port: 5432,
        database: 'chosen db',
        user: 'selected',
        password: 'p ass%word',
        application_name: 'seed job',
        options: '-c statement_timeout=5000',
        ssl: {},
      },
    });
  });

  it.each([
    'postgresql://u:p ass@selected.invalid/chosen',
    'postgresql://u:p ass@selected.invalid:5432/chosen',
    'postgresql://u:p%20ass%xx@selected.invalid/chosen',
    'postgresql://u:p%20ass%2@selected.invalid:5432/chosen',
    'postgresql://u:p@selected.invalid/chosen?application_name=seed job',
    'postgresql://u:p@selected.invalid:5432/chosen?application_name=%20%GG',
    'postgresql://u:p@selected.invalid/chosen\n',
    'postgresql://u:p@selected.invalid:5432/chosen\t',
    'postgresql://u:p@selected.invalid:5432/chosen\u007f',
  ])('refuses driver preprocessing ambiguity before connecting: %j', async (selected) => {
    process.env.POSTGRES_URL = selected;
    process.env.DATABASE_URL = 'postgresql://fallback.invalid/other';
    const connect = vi.fn().mockResolvedValue(undefined);
    expect(parseDbTarget(selected)).toBeNull();
    await expect(assertSeedDatabaseReady({ connect })).rejects.toBeInstanceOf(SeedEnvError);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects raw NUL in parser input before URL can strip it', () => {
    // process.env cannot represent NUL bytes, so exercise the parser boundary.
    expect(parseDbTarget('postgresql://u:p@selected.invalid/chosen\u0000')).toBeNull();
  });
});

describe('assertSeedDatabaseReady', () => {
  const prevPg = process.env.POSTGRES_URL;
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevPg === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = prevPg;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it.each([
    'postgres://revealui:x@localhost:5434/revealui_probe?sslmode=disable',
    'postgres://revealui:x@localhost:5432/%72evealui_probe?sslmode=disable',
  ])('refuses the probe database before connecting: %s', async (selected) => {
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).rejects.toBeInstanceOf(SeedEnvError);
    await expect(assertSeedDatabaseReady({ connect })).rejects.toThrow(
      /electric-latency-probe|5434|revealui_probe/,
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it('accepts passwordless trust authentication when the connector succeeds', async () => {
    const selected = 'postgresql://selected@selected.invalid/chosen';
    const bound = 'postgresql://selected@selected.invalid:5432/chosen';
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: bound });
    expect(connect).toHaveBeenCalledExactlyOnceWith(bound);
  });

  it.each([
    'postgresql://selected@selected.invalid/chosen',
    'postgresql://selected:private-password@selected.invalid/chosen',
  ])(
    'fails closed on authentication failure without exposing driver credentials: %s',
    async (selected) => {
      process.env.POSTGRES_URL = selected;
      const bound = selected.replace('selected.invalid/', 'selected.invalid:5432/');
      const connect = vi
        .fn()
        .mockRejectedValue(new Error(`authentication failed for ${selected}: private-password`));
      const failure = await assertSeedDatabaseReady({ connect }).catch((error: unknown) => error);
      expect(connect).toHaveBeenCalledExactlyOnceWith(bound);
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

  it('refuses the probe even when the old override is present', async () => {
    process.env.POSTGRES_URL =
      'postgres://revealui:x@localhost:5434/revealui_probe?sslmode=disable';
    const previous = process.env.REVEALUI_ALLOW_PROBE_DB;
    process.env.REVEALUI_ALLOW_PROBE_DB = '1';
    try {
      const connect = vi.fn().mockResolvedValue(undefined);
      await expect(assertSeedDatabaseReady({ connect })).rejects.toThrow(
        /Seed refused the electric-latency-probe database/,
      );
      expect(connect).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.REVEALUI_ALLOW_PROBE_DB;
      else process.env.REVEALUI_ALLOW_PROBE_DB = previous;
    }
  });

  it('preserves supported non-routing query options for the connector', async () => {
    const selected =
      'postgresql://selected@selected.invalid/chosen?sslmode=require&application_name=seed';
    const bound =
      'postgresql://selected@selected.invalid:5432/chosen?sslmode=require&application_name=seed';
    process.env.POSTGRES_URL = selected;
    const connect = vi.fn().mockResolvedValue(undefined);
    await expect(assertSeedDatabaseReady({ connect })).resolves.toMatchObject({ url: bound });
    expect(connect).toHaveBeenCalledExactlyOnceWith(bound);
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
  it.each([
    ['apps/admin/src/seed.ts', 'await assertBootstrapCredentialsIfEmptyUsers()'],
    ['scripts/setup/seed-billing.ts', 'getClient()'],
    ['scripts/seed-fleet-marketing-site.ts', "getClient('rest')"],
    ['scripts/seed-fleet-marketing-home-page.ts', "getClient('rest')"],
  ])('preflights before the first database consumer in %s', (path, consumer) => {
    const source = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
    const main = source.slice(source.indexOf('async function main('));
    const preflight = main.indexOf('await assertSeedDatabaseReady(');
    expect(source.indexOf('loadSeedEnv(')).toBeGreaterThanOrEqual(0);
    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(main.indexOf(consumer)).toBeGreaterThan(preflight);
  });

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
