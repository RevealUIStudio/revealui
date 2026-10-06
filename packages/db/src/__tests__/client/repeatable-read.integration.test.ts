import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeAllPools, resetClient, withReadOnlyRepeatableRead } from '../../client/index.js';

const databaseUrl =
  process.env.TEST_POSTGRES_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;
const originalPostgresUrl = process.env.POSTGRES_URL;

describeWithPostgres('read-only repeatable-read transaction (PostgreSQL integration)', () => {
  const writerPool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const tableName = `gdpr_snapshot_${randomUUID().replaceAll('-', '')}`;
  const table = sql`${sql.identifier('public')}.${sql.identifier(tableName)}`;

  beforeAll(() => {
    if (databaseUrl) process.env.POSTGRES_URL = databaseUrl;
  });

  afterAll(async () => {
    if (writerPool) {
      await writerPool.query(`DROP TABLE IF EXISTS public."${tableName}"`);
      await writerPool.end();
    }
    await closeAllPools();
    resetClient();
    if (originalPostgresUrl === undefined) Reflect.deleteProperty(process.env, 'POSTGRES_URL');
    else process.env.POSTGRES_URL = originalPostgresUrl;
  });

  it('keeps pages and totals on one snapshot while another connection commits writes', async () => {
    if (!writerPool) throw new Error('PostgreSQL integration URL is unavailable');
    await writerPool.query(
      `CREATE TABLE public."${tableName}" (id integer PRIMARY KEY, payload text NOT NULL)`,
    );
    await writerPool.query(`INSERT INTO public."${tableName}" VALUES (1, 'first'), (2, 'before')`);

    const snapshot = await withReadOnlyRepeatableRead(async (transactionClient) => {
      const firstPage = await transactionClient.execute<{
        backend_pid: number;
        id: number;
        payload: string;
      }>(
        sql`SELECT pg_backend_pid() AS backend_pid, id, payload FROM ${table} ORDER BY id LIMIT 1 OFFSET 0`,
      );

      await writerPool.query(`UPDATE public."${tableName}" SET payload = 'after' WHERE id = 2`);
      await writerPool.query(`INSERT INTO public."${tableName}" VALUES (3, 'third')`);
      await writerPool.query(`DELETE FROM public."${tableName}" WHERE id = 1`);

      const secondPage = await transactionClient.execute<{
        backend_pid: number;
        id: number;
        payload: string;
      }>(
        sql`SELECT pg_backend_pid() AS backend_pid, id, payload FROM ${table} ORDER BY id LIMIT 1 OFFSET 1`,
      );
      const totalResult = await transactionClient.execute<{ total: number }>(
        sql`SELECT count(*)::integer AS total FROM ${table}`,
      );

      return {
        firstPage: firstPage.rows,
        secondPage: secondPage.rows,
        total: totalResult.rows[0]?.total,
      };
    });

    expect(snapshot.firstPage.map((row) => [row.id, row.payload])).toEqual([[1, 'first']]);
    expect(snapshot.secondPage.map((row) => [row.id, row.payload])).toEqual([[2, 'before']]);
    expect(snapshot.firstPage[0]?.backend_pid).toBe(snapshot.secondPage[0]?.backend_pid);
    expect(snapshot.total).toBe(2);

    const currentRows = await writerPool.query(
      `SELECT count(*)::integer AS total FROM public."${tableName}"`,
    );
    expect(currentRows.rows[0]?.total).toBe(2);
  });

  it('rejects writes in the read-only transaction', async () => {
    if (!writerPool) throw new Error('PostgreSQL integration URL is unavailable');
    await expect(
      withReadOnlyRepeatableRead(async (transactionClient) =>
        transactionClient.execute(sql`INSERT INTO ${table} VALUES (4, 'forbidden')`),
      ),
    ).rejects.toThrow();
  });
});
