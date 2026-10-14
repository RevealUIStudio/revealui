/** Actual pg adapter regressions; only the explicit disposable CI service is accepted. */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, restoreBackup } from '@revealui/scripts/database/backup-manager';
import { createConnection, type DatabaseConnection } from '@revealui/scripts/database/connection';
import { withTransaction } from '@revealui/scripts/database/transaction-manager';
import { escapeIdentifier, Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const target = process.env.TEST_DATABASE_URL;
if (process.env.CI && !target)
  throw new Error('PostgreSQL integration CI requires the explicit disposable TEST_DATABASE_URL');

describe.skipIf(!target)('backup integrity through the supported pg adapter', () => {
  let control: Pool;
  let connection: DatabaseConnection;
  let databaseName: string;
  let created = false;
  let directory: string;
  const roles: string[] = [];

  beforeAll(async () => {
    const url = new URL(target as string);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.search ||
      url.hash ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '5432' ||
      url.pathname !== '/revealui_test' ||
      url.username !== 'test' ||
      url.password !== 'test'
    ) {
      throw new Error(
        'Backup integration accepts only the explicit disposable localhost CI PostgreSQL service',
      );
    }
    control = new Pool({ connectionString: url.toString(), ssl: false });
    databaseName = `backup_integrity_${randomUUID().split('-').join('')}`;
    await control.query(`CREATE DATABASE ${escapeIdentifier(databaseName)}`);
    created = true;
    url.pathname = `/${databaseName}`;
    connection = await createConnection({
      connectionString: url.toString(),
      ssl: false,
      poolSize: 3,
    });
    directory = await mkdtemp(join(tmpdir(), 'revealui-pg-backup-'));
  });
  beforeEach(async () => {
    await connection.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await connection.query(
      'CREATE TABLE first(id integer PRIMARY KEY, text text); CREATE TABLE second(id integer PRIMARY KEY, text text)',
    );
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    const failures: unknown[] = [];
    async function cleanup(operation: () => Promise<unknown>): Promise<void> {
      try {
        await operation();
      } catch (error) {
        failures.push(error);
      }
    }
    if (connection) await cleanup(() => connection.close());
    if (control) {
      if (created)
        await cleanup(() => control.query(`DROP DATABASE ${escapeIdentifier(databaseName)}`));
      for (const role of roles)
        await cleanup(() => control.query(`DROP ROLE ${escapeIdentifier(role)}`));
      await cleanup(() => control.end());
    }
    if (directory) await cleanup(() => rm(directory, { recursive: true, force: true }));
    if (failures.length)
      throw new AggregateError(failures, 'Owned backup integration fixture cleanup failed');
  });

  async function limitedConnection(): Promise<DatabaseConnection> {
    const role = `backup_role_${randomUUID().split('-').join('')}`;
    await connection.query(`CREATE ROLE ${escapeIdentifier(role)}`);
    roles.push(role);
    await connection.query(
      `GRANT USAGE ON SCHEMA public TO ${escapeIdentifier(role)}; GRANT SELECT ON first, second TO ${escapeIdentifier(role)}`,
    );
    return {
      ...connection,
      async connect() {
        const client = await connection.connect();
        try {
          await client.query(`SET ROLE ${escapeIdentifier(role)}`);
        } catch (error) {
          client.release(true);
          throw error;
        }
        // Destroy this synthetic restricted lease so role state never returns
        // to the owner's pool. DatabaseConnection still supplies the actual pg client.
        const release = client.release.bind(client);
        client.release = () => release(true);
        return client;
      },
    };
  }

  it('refuses an all-table snapshot when an intended catalog table is inaccessible', async () => {
    await connection.query(
      'CREATE TABLE private_rows(id integer); INSERT INTO private_rows VALUES(1)',
    );
    const restricted = await limitedConnection();
    const artifacts = await readdir(directory);
    const result = await createBackup(restricted, import.meta.url, { backupDir: directory });
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(await readdir(directory)).toEqual(artifacts);
  });

  it('refuses a row-security-filtered snapshot rather than publishing partial data', async () => {
    await connection.query(
      "INSERT INTO first VALUES(1,'visible'),(2,'hidden'); ALTER TABLE first ENABLE ROW LEVEL SECURITY; CREATE POLICY visible_first ON first USING(id=1)",
    );
    const restricted = await limitedConnection();
    const artifacts = await readdir(directory);
    const result = await createBackup(restricted, import.meta.url, { backupDir: directory });
    expect(result.success).toBe(false);
    expect(result.error).toContain('row-level security');
    expect(await readdir(directory)).toEqual(artifacts);
  });

  it('roundtrips a compatible enum type outside the search path', async () => {
    await connection.query(
      "CREATE SCHEMA custom_types; CREATE TYPE custom_types.mood AS ENUM ('calm'); CREATE TABLE typed_enum(id integer PRIMARY KEY, mood custom_types.mood); INSERT INTO typed_enum VALUES(1,'calm')",
    );
    const backup = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      tables: ['typed_enum'],
    });
    expect(backup.success).toBe(true);
    await connection.query('DELETE FROM typed_enum');
    expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
    expect((await connection.query('SELECT * FROM typed_enum')).rows).toEqual([
      { id: 1, mood: 'calm' },
    ]);
  });

  it('refuses a storable type whose PostgreSQL input rejects its text output before publication', async () => {
    await connection.query(`CREATE TABLE source_check(id integer CONSTRAINT positive_id CHECK(id > 0));
      CREATE TABLE unsupported_text(tree pg_node_tree);
      INSERT INTO unsupported_text SELECT conbin FROM pg_catalog.pg_constraint
        WHERE conname='positive_id' AND conrelid='source_check'::regclass`);
    const stored = await connection.query<{ tree: string }>(
      'SELECT tree::text FROM unsupported_text',
    );
    expect(stored.rows).toHaveLength(1);
    await expect(
      connection.query('SELECT $1::pg_node_tree', [stored.rows[0]?.tree]),
    ).rejects.toThrow('cannot accept');
    const prior = join(directory, 'backup-prior.json');
    await writeFile(prior, '{"first":[]}');
    const artifacts = await readdir(directory);
    const backup = await createBackup(connection, import.meta.url, {
      backupDir: directory,
      tables: ['unsupported_text'],
      retainCount: 1,
    });
    expect(backup.success).toBe(false);
    expect(await readdir(directory)).toEqual(artifacts);
    expect(await readFile(prior, 'utf8')).toBe('{"first":[]}');
  });

  it.each(['json', 'sql'] as const)(
    'refuses numeric scale narrowing before destructive writes in %s',
    async (format) => {
      await connection.query(
        'CREATE TABLE amounts(id integer PRIMARY KEY, value numeric(10,4)); INSERT INTO amounts VALUES(1,1.2345)',
      );
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        tables: ['amounts'],
        format,
      });
      expect(backup.success).toBe(true);
      await connection.query(
        'ALTER TABLE amounts ALTER COLUMN value TYPE numeric(10,2); DELETE FROM amounts; INSERT INTO amounts VALUES(99,9.87)',
      );
      const destructive: string[] = [];
      const actualConnect = connection.connect.bind(connection);
      vi.spyOn(connection, 'connect').mockImplementation(async () => {
        const leased = await actualConnect();
        return new Proxy(leased, {
          get(client, property) {
            if (property === 'query')
              return (sql: string, ...args: unknown[]) => {
                if (sql.startsWith('DELETE')) destructive.push(sql);
                return Reflect.apply(client.query, client, [sql, ...args]);
              };
            const value = Reflect.get(client, property);
            return typeof value === 'function' ? value.bind(client) : value;
          },
        });
      });
      expect((await restoreBackup(connection, backup.path as string)).success).toBe(false);
      expect(destructive).toEqual([]);
      expect((await connection.query('SELECT id,value::text AS value FROM amounts')).rows).toEqual([
        { id: 99, value: '9.87' },
      ]);
    },
  );

  it.each(['json', 'sql'] as const)(
    'preserves float bits and bytea in %s under differing session output settings',
    async (format) => {
      await connection.query(
        "CREATE TABLE guc_typed(id integer PRIMARY KEY, value double precision, bytes bytea); INSERT INTO guc_typed VALUES(1,1.2345678901234567,'\\x0001ff')",
      );
      const expected = (
        await connection.query(
          "SELECT encode(float8send(value),'hex') AS bits, encode(bytes,'hex') AS bytes FROM guc_typed",
        )
      ).rows;
      const connect = connection.connect.bind(connection);
      vi.spyOn(connection, 'connect').mockImplementation(async () => {
        const client = await connect();
        await client.query("SET extra_float_digits=0; SET bytea_output='escape'");
        return client;
      });
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        tables: ['guc_typed'],
        format,
      });
      expect(backup.success, backup.error).toBe(true);
      await connection.query('DELETE FROM guc_typed');
      expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
      expect(
        (
          await connection.query(
            "SELECT encode(float8send(value),'hex') AS bits, encode(bytes,'hex') AS bytes FROM guc_typed",
          )
        ).rows,
      ).toEqual(expected);
    },
  );

  it('publishes one consistent snapshot while another PostgreSQL client changes both tables', async () => {
    await connection.query(
      "INSERT INTO first VALUES(1,'before'); INSERT INTO second VALUES(1,'before')",
    );
    const writer = await connection.connect();
    const connect = connection.connect.bind(connection);
    let changed = false;
    vi.spyOn(connection, 'connect').mockImplementation(async () => {
      const reader = await connect();
      return new Proxy(reader, {
        get(client, key) {
          if (key === 'query')
            return async (sql: string, ...args: unknown[]) => {
              const result = await Reflect.apply(client.query, client, [sql, ...args]);
              if (
                !changed &&
                sql.startsWith('SELECT') &&
                sql.includes('FROM ONLY "public"."first"')
              ) {
                changed = true;
                await writer.query('BEGIN');
                try {
                  await writer.query(
                    "UPDATE first SET text='after'; UPDATE second SET text='after'",
                  );
                  await writer.query('COMMIT');
                } catch (error) {
                  await writer.query('ROLLBACK');
                  throw error;
                }
              }
              return result;
            };
          const value = Reflect.get(client, key);
          return typeof value === 'function' ? value.bind(client) : value;
        },
      });
    });
    try {
      const backup = await createBackup(connection, import.meta.url, { backupDir: directory });
      expect(backup.success).toBe(true);
      expect(changed).toBe(true);
      const artifact = JSON.parse(await readFile(backup.path as string, 'utf8'));
      expect(artifact.tables.first).toEqual([{ id: '1', text: 'before' }]);
      expect(artifact.tables.second).toEqual([{ id: '1', text: 'before' }]);
      expect(
        (await connection.query('SELECT text FROM first UNION ALL SELECT text FROM second')).rows,
      ).toEqual([{ text: 'after' }, { text: 'after' }]);
    } finally {
      writer.release();
    }
  });

  it('publishes no artifact and preserves an older backup after an actual later-table read denial', async () => {
    const prior = join(directory, 'backup-prior.json');
    await writeFile(prior, '{"first":[]}');
    const artifacts = await readdir(directory);
    const restricted = await limitedConnection();
    const role = roles.at(-1);
    await connection.query(`REVOKE SELECT ON second FROM ${escapeIdentifier(role as string)}`);
    const result = await createBackup(restricted, import.meta.url, {
      backupDir: directory,
      retainCount: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(await readdir(directory)).toEqual(artifacts);
    expect(await readFile(prior, 'utf8')).toBe('{"first":[]}');
  });

  it.each(['json', 'sql'] as const)(
    'roundtrips %s including empty tables and exact PostgreSQL text values',
    async (format) => {
      await connection.query(`CREATE TABLE typed(id integer PRIMARY KEY, big bigint, amount numeric, stamp timestamp, body jsonb, items integer[], bytes bytea);
      INSERT INTO typed VALUES (1,9007199254740993,12345678901234567890.123456789,'2026-10-05 01:02:03.123456','[1,"two"]','{1,2,3}','\\x0001ff')`);
      await connection.query('INSERT INTO first VALUES ($1,$2)', [1, "quoted; -- ' \\ text"]);
      const expected = await connection.query(
        'SELECT big::text, amount::text, stamp::text, body::text, items::text, bytes::text FROM typed',
      );
      const backup = await createBackup(connection, import.meta.url, {
        backupDir: directory,
        format,
      });
      expect(backup.success).toBe(true);
      await connection.query(
        "DELETE FROM first; DELETE FROM typed; INSERT INTO second VALUES(99,'current')",
      );
      expect(await restoreBackup(connection, backup.path as string)).toEqual({ success: true });
      expect((await connection.query('SELECT * FROM first')).rows).toEqual([
        { id: 1, text: "quoted; -- ' \\ text" },
      ]);
      expect((await connection.query('SELECT * FROM second')).rows).toEqual([]);
      expect(
        (
          await connection.query(
            'SELECT big::text, amount::text, stamp::text, body::text, items::text, bytes::text FROM typed',
          )
        ).rows,
      ).toEqual(expected.rows);
    },
  );

  it('rolls back a later constraint failure on one leased client without pool queries', async () => {
    await connection.query(
      "INSERT INTO first VALUES(99,'original'); INSERT INTO second VALUES(99,'original')",
    );
    const file = join(directory, 'backup-invalid.json');
    await writeFile(
      file,
      JSON.stringify({
        first: [{ id: 1, text: 'new' }],
        second: [
          { id: 2, text: 'one' },
          { id: 2, text: 'duplicate' },
        ],
      }),
    );
    const connect = vi.spyOn(connection, 'connect');
    const poolQuery = vi.spyOn(connection.pool, 'query');
    expect((await restoreBackup(connection, file)).success).toBe(false);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(poolQuery).not.toHaveBeenCalled();
    poolQuery.mockRestore();
    expect((await connection.query('SELECT * FROM first')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
    expect((await connection.query('SELECT * FROM second')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
  });

  it('keeps one PostgreSQL backend session throughout the managed transaction', async () => {
    const pids = await withTransaction(connection, async ({ client }) => {
      const first = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      await client.query("INSERT INTO first VALUES(1,'new')");
      const second = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      return [first.rows[0]?.pid, second.rows[0]?.pid];
    });
    expect(pids[0]).toBeTypeOf('number');
    expect(pids[1]).toBe(pids[0]);
  });

  it('rejects PostgreSQL acknowledged rollback after a callback swallowed its SQL error', async () => {
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
    expect((await connection.query('SELECT * FROM first')).rows).toEqual([]);
  });

  it('cancels an overlong PostgreSQL statement and releases a usable client after rollback', async () => {
    await expect(
      withTransaction(
        connection,
        async ({ client }) => {
          await client.query("INSERT INTO first VALUES(1,'new')");
          await client.query('SELECT pg_sleep(0.1)');
        },
        { timeout: 20 },
      ),
    ).rejects.toMatchObject({ code: '57014' });
    expect((await connection.query('SELECT * FROM first')).rows).toEqual([]);
    expect((await connection.query('SELECT 1 AS healthy')).rows).toEqual([{ healthy: 1 }]);
  });

  it('rolls back AbortSignal cancellation after leased writes and releases once', async () => {
    await connection.query("INSERT INTO first VALUES(99,'original')");
    const controller = new AbortController();
    let release: ReturnType<typeof vi.spyOn> | undefined;
    const connect = connection.connect.bind(connection);
    vi.spyOn(connection, 'connect').mockImplementation(async () => {
      const client = await connect();
      release = vi.spyOn(client, 'release');
      return client;
    });
    await expect(
      withTransaction(
        connection,
        async ({ client }) => {
          await client.query("DELETE FROM first; INSERT INTO first VALUES(1,'new')");
          controller.abort(new Error('synthetic cancellation'));
        },
        { signal: controller.signal },
      ),
    ).rejects.toThrow('synthetic cancellation');
    expect(release).toHaveBeenCalledExactlyOnceWith(false);
    expect((await connection.query('SELECT * FROM first')).rows).toEqual([
      { id: 99, text: 'original' },
    ]);
  });

  it('rolls back a callback that writes after its deadline without releasing mid-callback', async () => {
    let leaseRelease: ReturnType<typeof vi.spyOn> | undefined;
    const originalConnect = connection.connect.bind(connection);
    vi.spyOn(connection, 'connect').mockImplementation(async () => {
      const client = await originalConnect();
      leaseRelease = vi.spyOn(client, 'release');
      return client;
    });
    await expect(
      withTransaction(
        connection,
        async ({ client }) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          expect(leaseRelease).not.toHaveBeenCalled();
          await client.query("INSERT INTO first VALUES(1,'late')");
        },
        { timeout: 10 },
      ),
    ).rejects.toThrow('timed out');
    expect(leaseRelease).toHaveBeenCalledTimes(1);
    expect((await connection.query('SELECT * FROM first')).rows).toEqual([]);
  });

  it('destroys the terminated client when rollback cannot confirm cleanup', async () => {
    let release: ReturnType<typeof vi.spyOn> | undefined;
    const originalConnect = connection.connect.bind(connection);
    vi.spyOn(connection, 'connect').mockImplementation(async () => {
      const client = await originalConnect();
      release = vi.spyOn(client, 'release');
      client.on('error', () => undefined);
      return client;
    });
    const failure = new Error('original callback failure');
    await expect(
      withTransaction(connection, async ({ client }) => {
        const result = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
        await control.query('SELECT pg_terminate_backend($1)', [result.rows[0]?.pid]);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
    expect((await connection.query('SELECT 1 AS healthy')).rows).toEqual([{ healthy: 1 }]);
  });
});
