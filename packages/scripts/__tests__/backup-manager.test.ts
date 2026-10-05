import { spawnSync } from 'node:child_process';
import {
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite, protocol } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseConnection } from '../database/connection.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    link: vi.fn(actual.link),
    open: vi.fn(actual.open),
    unlink: vi.fn(actual.unlink),
  };
});

const dependencies = vi.hoisted(() => ({ tables: ['first', 'second'] }));
vi.mock('../index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
  getProjectRoot: async () => '.',
  listTables: async () => dependencies.tables,
}));

import {
  createBackup,
  listBackups,
  publication,
  restoreBackup,
} from '../database/backup-manager.js';
import { withTransaction } from '../database/transaction-manager.js';

async function verifyCLI(directory: string) {
  const sourceRoot = dirname(fileURLToPath(import.meta.url));
  const owner = resolve(sourceRoot, '../database/backup-manager.ts');
  const transaction = resolve(sourceRoot, '../database/transaction-manager.ts');
  const script = resolve(sourceRoot, '../../../scripts/commands/database/verify-backup.ts');
  const loader = join(directory, 'verify-imports.mjs');
  await writeFile(
    loader,
    `
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const utility = 'const log=()=>undefined; export const createLogger=()=>({info:log,debug:log,warn:log,error:log,success:log}); export const getProjectRoot=async()=>process.cwd();';
    const owner = pathToFileURL(${JSON.stringify(owner)}).href;
    const transaction = pathToFileURL(${JSON.stringify(transaction)}).href;
    registerHooks({resolve(specifier, context, next) {
      if (specifier === '@revealui/scripts/database/backup-manager.js') return {url:owner,shortCircuit:true};
      if (specifier === '@revealui/scripts/index.js' || (specifier === '../index.js' && [owner,transaction].includes(context.parentURL))) return {url:'data:text/javascript,'+encodeURIComponent(utility),shortCircuit:true};
      if (specifier === './transaction-manager.js' && context.parentURL === owner) return {url:transaction,shortCircuit:true};
      return next(specifier,context);
    }});
  `,
  );
  return spawnSync(process.execPath, ['--import', loader, script, '--dir=backups'], {
    cwd: directory,
    env: { NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 30000,
  });
}

describe('backup and restore data integrity', () => {
  let database: PGlite;
  let directory: string;
  let connection: DatabaseConnection;
  let client: PoolClient;
  let failedRead: string | undefined;

  beforeAll(async () => {
    database = new PGlite();
    await database.waitReady;
  });
  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'revealui-backup-test-'));
    failedRead = undefined;
    await database.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await database.exec(
      'CREATE TABLE first (id integer PRIMARY KEY, text text); CREATE TABLE second (id integer PRIMARY KEY, text text)',
    );
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (failedRead && sql.startsWith('SELECT') && sql.includes(`"${failedRead}"`))
        throw new Error('injected table read failure');
      if (sql === 'COMMIT') {
        const response = await database.execProtocol(protocol.serialize.query(sql), {
          throwOnError: true,
        });
        const terminal = response.messages.find((entry) => entry.name === 'commandComplete');
        if (!(terminal && 'text' in terminal) || typeof terminal.text !== 'string')
          throw new Error('Missing PostgreSQL command acknowledgement');
        return { rows: [], rowCount: 0, command: terminal.text.split(' ')[0] };
      }
      // pg sends existing strings as text even for bytea/json/array parameters.
      // PGlite's default serializers instead treat them as JS typed values.
      const description = params?.length ? await database.describeQuery(sql) : undefined;
      const serializers = Object.fromEntries(
        (description?.queryParams ?? []).map((parameter) => [
          parameter.dataTypeID,
          (value: unknown) => (typeof value === 'string' ? value : parameter.serializer(value)),
        ]),
      );
      const result = await database.query(sql, params, { serializers });
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    });
    client = { query, release: vi.fn() } as unknown as PoolClient;
    connection = {
      pool: { options: {} },
      provider: 'postgres',
      type: 'rest',
      query,
      connect: vi.fn(async () => client),
      close: vi.fn(),
    } as unknown as DatabaseConnection;
    dependencies.tables = ['first', 'second'];
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    vi.mocked(link).mockRestore();
    vi.mocked(open).mockRestore();
    vi.mocked(unlink).mockRestore();
    if (vi.isMockFunction(publication.publishVerified)) publication.publishVerified.mockRestore();
  });

  it.each(['json', 'sql'] as const)(
    'refuses numeric scale narrowing before clear in %s',
    async (format) => {
      await database.exec(
        'CREATE TABLE amounts (id integer PRIMARY KEY, value numeric(10,4)); INSERT INTO amounts VALUES (1, 1.2345)',
      );
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        format,
        tables: ['amounts'],
      });
      expect(backup).toMatchObject({ success: true });
      await database.exec(
        'ALTER TABLE amounts ALTER COLUMN value TYPE numeric(10,2); DELETE FROM amounts; INSERT INTO amounts VALUES (99, 9.87)',
      );
      vi.mocked(client.query).mockClear();
      const restored = await restoreBackup(connection, backup.path as string);
      expect(restored.success).toBe(false);
      expect(
        vi
          .mocked(client.query)
          .mock.calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('DELETE')),
      ).toBe(false);
      expect((await database.query('SELECT id, value::text AS value FROM amounts')).rows).toEqual([
        { id: 99, value: '9.87' },
      ]);
    },
  );

  it('fails a later table read without publishing or retaining away a good backup', async () => {
    const prior = join(directory, 'backup-2000-01-01.json');
    await writeFile(prior, '{"first":[]}');
    failedRead = 'second';
    const result = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      retainCount: 1,
    });
    expect(result.success).toBe(false);
    expect(await readdir(directory)).toEqual(['backup-2000-01-01.json']);
    expect(await readFile(prior, 'utf8')).toBe('{"first":[]}');
  });

  it.each(['json', 'sql'] as const)(
    'preserves PostgreSQL values without precision loss in %s',
    async (format) => {
      await database.exec(`CREATE TABLE typed (id integer PRIMARY KEY, bigint_value bigint, decimal_value numeric,
      stamp timestamp, body jsonb, items integer[], bytes bytea, enabled boolean, optional text);
      INSERT INTO typed VALUES (1, 9007199254740993, 12345678901234567890.123456789,
      '2026-10-05 01:02:03.123456', '"scalar"', '{1,2,3}', '\\x0001ff', TRUE, NULL)`);
      dependencies.tables = ['typed'];
      const expected = (
        await database.query(
          'SELECT bigint_value::text, decimal_value::text, stamp::text, body::text, items::text, bytes::text, enabled, optional FROM typed',
        )
      ).rows;
      const result = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        format,
        tables: ['typed'],
      });
      expect(result.success).toBe(true);
      await database.exec('DELETE FROM typed');
      expect(await restoreBackup(connection, result.path as string)).toEqual({ success: true });
      expect(
        (
          await database.query(
            'SELECT bigint_value::text, decimal_value::text, stamp::text, body::text, items::text, bytes::text, enabled, optional FROM typed',
          )
        ).rows,
      ).toEqual(expected);
    },
  );

  it('distinguishes legacy JSON scalar strings from PostgreSQL text encoding', async () => {
    await database.exec('CREATE TABLE json_values (id integer PRIMARY KEY, body jsonb)');
    const file = join(directory, 'backup-legacy.json');
    await writeFile(
      file,
      JSON.stringify({
        json_values: [
          { id: 1, body: 'plain' },
          { id: 2, body: [1, 'two'] },
          { id: 3, body: { nested: true } },
        ],
      }),
    );
    expect(await restoreBackup(connection, file)).toEqual({ success: true });
    expect((await database.query('SELECT body FROM json_values ORDER BY id')).rows).toEqual([
      { body: 'plain' },
      { body: [1, 'two'] },
      { body: { nested: true } },
    ]);
  });

  it('restores canonical bytea text when the target session normally prints escape format', async () => {
    await database.exec(
      "CREATE TABLE typed_bytes(id integer PRIMARY KEY, value bytea); INSERT INTO typed_bytes VALUES(1,'\\x0001ff'); SET bytea_output='escape'",
    );
    try {
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        tables: ['typed_bytes'],
      });
      expect(backup.success, backup.error).toBe(true);
      await database.exec('DELETE FROM typed_bytes');
      expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
      expect(
        (await database.query("SELECT encode(value,'hex') AS value FROM typed_bytes")).rows,
      ).toEqual([{ value: '0001ff' }]);
    } finally {
      await database.exec('SET bytea_output=DEFAULT');
    }
  });

  it.each(['json', 'sql'] as const)(
    'preserves floating-point bits in %s despite a lossy session text setting',
    async (format) => {
      await database.exec(
        'CREATE TABLE floating(id integer PRIMARY KEY, value double precision); INSERT INTO floating VALUES(1,1.2345678901234567); SET extra_float_digits=0',
      );
      try {
        const expected = (
          await database.query("SELECT encode(float8send(value),'hex') AS bits FROM floating")
        ).rows;
        const backup = await createBackup(connection, import.meta.url, {
          backupDir: directory,
          tables: ['floating'],
          format,
        });
        expect(backup.success, backup.error).toBe(true);
        await database.exec('DELETE FROM floating');
        expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
        expect(
          (await database.query("SELECT encode(float8send(value),'hex') AS bits FROM floating"))
            .rows,
        ).toEqual(expected);
      } finally {
        await database.exec('SET extra_float_digits=DEFAULT');
      }
    },
  );

  it('restores a compatible enum column whose type is outside the search path', async () => {
    await database.exec(
      "CREATE SCHEMA custom_types; CREATE TYPE custom_types.mood AS ENUM ('calm', 'busy'); CREATE TABLE typed_enum(id integer PRIMARY KEY, mood custom_types.mood); INSERT INTO typed_enum VALUES(1,'calm')",
    );
    const backup = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      tables: ['typed_enum'],
    });
    expect(backup.success).toBe(true);
    await database.exec('DELETE FROM typed_enum');
    expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
    expect((await database.query('SELECT * FROM typed_enum')).rows).toEqual([
      { id: 1, mood: 'calm' },
    ]);
  });

  it('rejects PostgreSQL implicit rollback after a callback swallowed a SQL error', async () => {
    await expect(
      withTransaction(connection, async ({ client }) => {
        await client.query("INSERT INTO first VALUES(1,'new')");
        try {
          await client.query("INSERT INTO first VALUES(1,'duplicate')");
        } catch {
          /* Deliberately swallowed by the synthetic caller. */
        }
        return 'uncommitted';
      }),
    ).rejects.toThrow('rolled back');
    expect((await database.query('SELECT * FROM first')).rows).toEqual([]);
  });

  it('clears children first and inserts parents first regardless of backup ordering', async () => {
    await database.exec(
      'CREATE TABLE parent (id integer PRIMARY KEY); CREATE TABLE child (id integer PRIMARY KEY, parent_id integer REFERENCES parent(id)); INSERT INTO parent VALUES (99); INSERT INTO child VALUES (99,99)',
    );
    const file = join(directory, 'backup-fk.json');
    await writeFile(
      file,
      JSON.stringify({ child: [{ id: 1, parent_id: 1 }], parent: [{ id: 1 }] }),
    );
    expect(await restoreBackup(connection, file)).toEqual({ success: true });
    expect((await database.query('SELECT * FROM child')).rows).toEqual([{ id: 1, parent_id: 1 }]);
  });

  it('refuses omitted inbound foreign keys before destructive queries', async () => {
    await database.exec(
      'CREATE TABLE parent (id integer PRIMARY KEY); CREATE TABLE child (id integer REFERENCES parent(id)); INSERT INTO parent VALUES (99); INSERT INTO child VALUES (99)',
    );
    const file = join(directory, 'backup-inbound.json');
    await writeFile(file, '{"parent":[]}');
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect((await database.query('SELECT * FROM parent')).rows).toEqual([{ id: 99 }]);
    const query = client.query as unknown as ReturnType<typeof vi.fn>;
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
  });

  it.each([
    'COMMIT;',
    'DELETE FROM first;',
    'INSERT INTO first(id,text) VALUES (1, current_user);',
  ])('rejects unsupported SQL before leasing or writing: %s', async (content) => {
    const file = join(directory, 'backup-unsafe.sql');
    await writeFile(file, content);
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it('keeps prior completed backups on staging failure', async () => {
    await writeFile(join(directory, 'backup-prior.json'), '{"first":[]}');
    vi.mocked(open).mockRejectedValueOnce(new Error('injected staging failure'));
    expect(
      (await createBackup(connection, import.meta.url, { backupDir: directory, retainCount: 1 }))
        .success,
    ).toBe(false);
    expect(await readdir(directory)).toEqual(['backup-prior.json']);
  });

  it('keeps prior backups and hides staging files when atomic publication fails', async () => {
    await writeFile(join(directory, 'backup-prior.json'), '{"first":[]}');
    vi.spyOn(publication, 'publishVerified').mockRejectedValueOnce(
      new Error('injected publication failure'),
    );
    expect(
      (await createBackup(connection, import.meta.url, { backupDir: directory, retainCount: 1 }))
        .success,
    ).toBe(false);
    expect(await readdir(directory)).toEqual(['backup-prior.json']);
  });

  it.each([
    '{"first":[],"first":[{"id":1,"text":"lost target"}]}',
    '{"first":[{"id":1,"id":2,"text":"lost column"}]}',
  ])('rejects duplicate JSON properties before leasing or writing: %s', async (content) => {
    const file = join(directory, 'backup-duplicate.json');
    await writeFile(file, content);
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it('rejects nontext values in the versioned PostgreSQL text encoding', async () => {
    const file = join(directory, 'backup-wrong-encoding.json');
    await writeFile(
      file,
      '{"version":1,"encoding":"postgres-text","tables":{"first":[{"id":"1","text":42}]}}',
    );
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it.each([
    '{"version":2,"encoding":"postgres-text","tables":{"first":[]}}',
    '{"version":1,"encoding":"unknown","tables":{"first":[]}}',
    '{"first":[]} trailing',
    '{"first":[],}',
    '{/* unsupported comment */"first":[]}',
  ])('rejects unsupported or malformed JSON before leasing: %s', async (content) => {
    const file = join(directory, 'backup-malformed.json');
    await writeFile(file, content);
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect(connection.connect).not.toHaveBeenCalled();
  });

  it('does not delete a newer complete artifact when an older snapshot publishes late', async () => {
    let staged!: () => void;
    const firstStaged = new Promise<void>((resolve) => {
      staged = resolve;
    });
    let resume!: () => void;
    const publicationGate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let first = true;
    const publishVerified = publication.publishVerified;
    vi.spyOn(publication, 'publishVerified').mockImplementation(
      async (handle, source, destination) => {
        if (first) {
          first = false;
          await handle.utimes(0, 0);
          staged();
          await publicationGate;
        }
        await publishVerified(handle, source, destination);
      },
    );
    const older = createBackup(connection, import.meta.url, {
      backupDir: directory,
      retainCount: 1,
    });
    await firstStaged;
    let newer: Awaited<ReturnType<typeof createBackup>> = { success: false };
    try {
      newer = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        retainCount: 1,
      });
    } finally {
      resume();
      await older;
    }
    expect(newer.success).toBe(true);
    expect(await readFile(newer.path as string, 'utf8')).toBeTruthy();
  });

  it('does not let a late-created stage make an older snapshot prune a newer snapshot', async () => {
    let paused!: () => void;
    const committed = new Promise<void>((resolve) => {
      paused = resolve;
    });
    let resume!: () => void;
    const acknowledgement = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let first = true;
    vi.mocked(connection.connect).mockImplementation(
      async () =>
        new Proxy(client, {
          get(target, key) {
            if (key === 'query')
              return async (sql: string, ...args: unknown[]) => {
                const result = await Reflect.apply(target.query, target, [sql, ...args]);
                if (sql === 'COMMIT' && first) {
                  first = false;
                  paused();
                  await acknowledgement;
                }
                return result;
              };
            return Reflect.get(target, key);
          },
        }),
    );
    const older = createBackup(connection, import.meta.url, {
      backupDir: directory,
      retainCount: 1,
    });
    await committed;
    let newer: Awaited<ReturnType<typeof createBackup>> = { success: false };
    try {
      newer = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        retainCount: 1,
      });
    } finally {
      resume();
      await older;
    }
    expect(newer.success).toBe(true);
    expect(await readFile(newer.path as string, 'utf8')).toBeTruthy();
  });

  it('preserves prior backups when staging sync fails', async () => {
    await writeFile(join(directory, 'backup-prior.json'), '{"first":[]}');
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      vi.spyOn(handle, 'sync').mockRejectedValueOnce(new Error('injected stage sync failure'));
      return handle;
    });
    expect(
      (await createBackup(connection, import.meta.url, { backupDir: directory, retainCount: 1 }))
        .success,
    ).toBe(false);
    expect(await readdir(directory)).toEqual(['backup-prior.json']);
  });

  it('reports retention failure separately after complete publication', async () => {
    const prior = join(directory, 'backup-prior.json');
    await writeFile(prior, '{"first":[]}');
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    vi.mocked(unlink).mockImplementation(async (path) => {
      if (path === prior) throw new Error('injected retention failure');
      await actual.unlink(path);
    });
    const result = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      retainCount: 1,
    });
    expect(result.success).toBe(true);
    expect(result.warning).toContain('retention failed');
    expect(await readFile(prior, 'utf8')).toBe('{"first":[]}');
    expect(result.path && (await readFile(result.path, 'utf8'))).toBeTruthy();
  });

  it('rejects an explicitly requested missing table before publishing', async () => {
    const result = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      tables: ['missing'],
    });
    expect(result.success).toBe(false);
    expect(await readdir(directory)).toEqual([]);
  });

  it('refuses publication when a storable PostgreSQL type cannot accept its text output', async () => {
    await database.exec(`CREATE TABLE source_check(id integer CONSTRAINT positive_id CHECK(id > 0));
      CREATE TABLE unsupported_text(tree pg_node_tree);
      INSERT INTO unsupported_text SELECT conbin FROM pg_catalog.pg_constraint
        WHERE conname='positive_id' AND conrelid='source_check'::regclass`);
    const stored = await database.query<{ tree: string }>(
      'SELECT tree::text FROM unsupported_text',
    );
    expect(stored.rows).toHaveLength(1);
    await expect(database.query('SELECT $1::pg_node_tree', [stored.rows[0]?.tree])).rejects.toThrow(
      'cannot accept',
    );
    const prior = join(directory, 'backup-prior.json');
    await writeFile(prior, '{"first":[]}');
    const backup = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      tables: ['unsupported_text'],
      retainCount: 1,
    });
    expect(backup.success).toBe(false);
    expect(await readdir(directory)).toEqual(['backup-prior.json']);
    expect(await readFile(prior, 'utf8')).toBe('{"first":[]}');
  });

  it.each(['json', 'sql'] as const)(
    'verifies actual generated %s artifacts through the maintained public verifier',
    async (format) => {
      await database.exec(`CREATE TABLE users(id integer, text text); CREATE TABLE sites(id integer);
      CREATE TABLE pages(id integer); CREATE TABLE sessions(id integer); CREATE TABLE audit_log(id integer);
      INSERT INTO users VALUES(1,''); INSERT INTO sites VALUES(1)`);
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: join(directory, 'backups'),
        format,
      });
      expect(backup.success, backup.error).toBe(true);
      const result = await verifyCLI(directory);
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr + result.stdout).toBe(0);
      expect(result.stdout).toContain('Tables:  7');
      expect(result.stdout).toContain('Rows:    2');
      await database.exec(
        "DELETE FROM users; DELETE FROM sites; INSERT INTO first VALUES(99,'current')",
      );
      expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
      expect((await database.query('SELECT * FROM users')).rows).toEqual([{ id: 1, text: '' }]);
      expect((await database.query('SELECT * FROM first')).rows).toEqual([]);
    },
  );

  it('restores SQL zero, FALSE, and empty-string literals from maintained parser scalar defaults', async () => {
    await database.exec('CREATE TABLE flags(id integer PRIMARY KEY, enabled boolean, text text)');
    const file = join(directory, 'backup-default-literals.sql');
    await writeFile(
      file,
      `INSERT INTO "public"."flags" ("id","enabled","text") VALUES (0,FALSE,'');`,
    );
    expect(await restoreBackup(connection, file)).toEqual({ success: true });
    expect((await database.query('SELECT * FROM flags')).rows).toEqual([
      { id: 0, enabled: false, text: '' },
    ]);
  });

  it('verifies legacy JSON through the shared filename and decoder owners', async () => {
    await mkdir(join(directory, 'backups'));
    await writeFile(
      join(directory, 'backups', 'db-backup-legacy.json'),
      JSON.stringify({
        users: [{ id: 1 }],
        sites: [{ id: 1 }],
        pages: [],
        sessions: [],
        audit_log: [],
      }),
    );
    const result = await verifyCLI(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Tables:  5');
    expect(result.stdout).toContain('Rows:    2');
  });

  it.each([
    [
      'json',
      '{"users":[{"id":1}],"users":[],"sites":[{"id":1}],"pages":[],"sessions":[],"audit_log":[]}',
    ],
    ['json', '{"users":"invalid rows","sites":[{"id":1}],"pages":[],"sessions":[],"audit_log":[]}'],
    ['sql', 'INSERT INTO "public"."users" ("id") VALUES (1); DELETE FROM "public"."users";'],
    ['sql', 'INSERT INTO ???'],
  ])('refuses malformed %s artifacts through the actual verifier: %s', async (format, content) => {
    await mkdir(join(directory, 'backups'));
    await writeFile(join(directory, 'backups', `backup-invalid.${format}`), content);
    const result = await verifyCLI(directory);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('Backup syntax or data shape is invalid');
  });

  it('clears an empty represented table during replacement', async () => {
    await database.exec("INSERT INTO first VALUES (99, 'current')");
    const file = join(directory, 'backup-empty.json');
    await writeFile(file, '{"first":[]}');
    expect(await restoreBackup(connection, file)).toEqual({ success: true });
    expect((await database.query('SELECT * FROM first')).rows).toEqual([]);
    expect(connection.connect).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('roundtrips generated SQL comments and quoted semicolons across tables', async () => {
    await database.query('INSERT INTO first VALUES ($1, $2)', [1, "a; -- comment ' \\ tail"]);
    await database.query('INSERT INTO second VALUES ($1, $2)', [2, '/* text; */']);
    const backup = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      format: 'sql',
    });
    expect(backup.success).toBe(true);
    expect(backup.path).toBeDefined();
    await database.exec('DELETE FROM first; DELETE FROM second');
    expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
    expect((await database.query('SELECT * FROM first')).rows).toEqual([
      { id: 1, text: "a; -- comment ' \\ tail" },
    ]);
    expect((await database.query('SELECT * FROM second')).rows).toEqual([
      { id: 2, text: '/* text; */' },
    ]);
  });

  it('rolls back earlier clears and inserts when a later row violates a constraint', async () => {
    await database.exec(
      "INSERT INTO first VALUES (99, 'original'); INSERT INTO second VALUES (99, 'original')",
    );
    const file = join(directory, 'backup-invalid.json');
    await writeFile(
      file,
      JSON.stringify({
        first: [{ id: 1, text: 'replacement' }],
        second: [
          { id: 2, text: 'one' },
          { id: 2, text: 'duplicate' },
        ],
      }),
    );
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect((await database.query('SELECT * FROM first')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
    expect((await database.query('SELECT * FROM second')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('validates a malformed later table before any destructive query', async () => {
    await database.exec("INSERT INTO first VALUES (99, 'original')");
    const file = join(directory, 'backup-malformed.json');
    await writeFile(file, '{"first":[{"id":1,"text":"replacement"}],"second":null}');
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect((await database.query('SELECT * FROM first')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
    const query = client.query as unknown as ReturnType<typeof vi.fn>;
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
  });

  it('appends represented data without clearing when requested', async () => {
    await database.exec("INSERT INTO first VALUES (99, 'original')");
    const file = join(directory, 'backup-append.json');
    await writeFile(file, '{"first":[{"id":1,"text":"new"}]}');
    expect(await restoreBackup(connection, file, { clearTables: false })).toEqual({
      success: true,
    });
    expect((await database.query('SELECT id FROM first ORDER BY id')).rows).toEqual([
      { id: 1 },
      { id: 99 },
    ]);
  });

  it('does not list staging files or foreign files as completed backups', async () => {
    await writeFile(join(directory, 'backup-complete.json'), '{}');
    await writeFile(join(directory, '.backup-stage.json'), '{}');
    await writeFile(join(directory, 'backup-foreign.txt'), '{}');
    expect(await listBackups(import.meta.url, { backupDir: directory })).toEqual([
      'backup-complete.json',
    ]);
  });
});
