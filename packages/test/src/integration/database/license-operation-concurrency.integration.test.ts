/** Real PostgreSQL connections; PGlite cannot prove advisory-lock concurrency. */
import { randomUUID } from 'node:crypto';
import { createClient } from '@revealui/db/client';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type TestConnection = NodePgDatabase & { $client: { end(): Promise<void> } };
const databaseUrl = process.env.TEST_DATABASE_URL;
const required = process.env.LICENSE_OPERATION_POSTGRES_REQUIRED === 'true';

describe.runIf(required || Boolean(databaseUrl))(
  'license operations on independent PostgreSQL connections',
  () => {
    let first: TestConnection;
    let second: TestConnection;
    const customers: string[] = [];

    beforeAll(async () => {
      if (!databaseUrl)
        throw new Error('TEST_DATABASE_URL is required for PostgreSQL license tests');
      const target = new URL(databaseUrl);
      if (
        !(
          ['postgres:', 'postgresql:'].includes(target.protocol) &&
          !target.search &&
          !target.hash &&
          ['localhost', '127.0.0.1'].includes(target.hostname) &&
          ['/revealui_migrations', '/revealui_test', '/test_revealui'].includes(target.pathname)
        )
      ) {
        throw new Error('License PostgreSQL tests require the maintained loopback test database');
      }
      first = createClient({ connectionString: databaseUrl }) as unknown as TestConnection;
      second = createClient({ connectionString: databaseUrl }) as unknown as TestConnection;
      const a = await first.execute(sql`select pg_backend_pid() as pid`);
      const b = await second.execute(sql`select pg_backend_pid() as pid`);
      expect(a.rows[0]?.pid).not.toBe(b.rows[0]?.pid);
    });

    afterAll(async () => {
      if (first) {
        for (const customer of customers) {
          await first.execute(sql`delete from license_operations where customer_id = ${customer}`);
          await first.execute(
            sql`delete from license_jti_revocations where customer_id = ${customer}`,
          );
          await first.execute(sql`delete from licenses where customer_id = ${customer}`);
        }
      }
      await Promise.all([first?.$client.end(), second?.$client.end()]);
    });

    async function seed(mode: 'live' | 'test' = 'live', customerId?: string) {
      const customer = customerId ?? `license-concurrency-${randomUUID()}`;
      const prior = `synthetic-prior-${randomUUID()}`;
      customers.push(customer);
      await first.execute(sql`insert into licenses(id, customer_id, license_key, tier, status, perpetual, mode)
      values (${randomUUID()}, ${customer}, ${prior}, 'pro', 'active', true, ${mode})`);
      return { customer, prior, jti: randomUUID(), mode };
    }

    async function apply(
      db: TestConnection,
      fixture: Awaited<ReturnType<typeof seed>>,
      operation: string,
      fingerprint: string,
      replacement: string,
    ) {
      const result = await db.execute(sql`select license_apply_operation(
      ${operation}::text, ${fingerprint}::text, ${fixture.customer}::text,
      ${fixture.prior}::text, ${fixture.jti}::text, null::timestamptz,
      ${randomUUID()}::text, ${replacement}::text, 'pro'::text, null::timestamptz, true, ${fixture.mode}::text,
      ${randomUUID()}::text
    ) as license_key`);
      return result.rows[0]?.license_key;
    }

    it('commits exactly one competing rotation and preserves its containment', async () => {
      const fixture = await seed();
      const results = await Promise.allSettled([
        apply(first, fixture, randomUUID(), 'request-a', 'synthetic-next-a'),
        apply(second, fixture, randomUUID(), 'request-b', 'synthetic-next-b'),
      ]);
      const successes = results.filter((result) => result.status === 'fulfilled');
      const failures = results.filter((result) => result.status === 'rejected');
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      const rejection: unknown = failures[0]?.reason;
      expect(
        String(rejection instanceof Error ? (rejection.cause ?? rejection) : rejection),
      ).toContain('license_current_conflict');
      const winner = successes[0];
      if (winner?.status !== 'fulfilled') throw new Error('No committed rotation');
      const row = await first.execute(
        sql`select license_key from licenses where customer_id = ${fixture.customer}`,
      );
      expect(row.rows[0]?.license_key).toBe(winner.value);
      const revoked = await second.execute(
        sql`select jti from license_jti_revocations where jti = ${fixture.jti}`,
      );
      expect(revoked.rows).toHaveLength(1);
      const operations = await first.execute(
        sql`select operation_id from license_operations where customer_id = ${fixture.customer}`,
      );
      expect(operations.rows).toHaveLength(1);
    });

    it('retries concurrent identical operations with the same committed token', async () => {
      const fixture = await seed();
      const operation = randomUUID();
      const results = await Promise.all([
        apply(first, fixture, operation, 'same-request', 'synthetic-attempt-a'),
        apply(second, fixture, operation, 'same-request', 'synthetic-attempt-b'),
      ]);
      expect(results[0]).toBe(results[1]);
      const operations = await first.execute(
        sql`select operation_id from license_operations where customer_id = ${fixture.customer}`,
      );
      expect(operations.rows).toHaveLength(1);
      await expect(
        apply(second, fixture, operation, 'changed-request', 'synthetic-attempt-c'),
      ).rejects.toThrow();
    });

    it('isolates live and test customer lineages and operation replay', async () => {
      const live = await seed();
      const test = await seed('test', live.customer);
      const operation = randomUUID();
      await apply(first, test, operation, 'test-request', 'synthetic-test-next');
      const row = await second.execute(sql`select license_key from licenses
        where customer_id = ${live.customer} and mode = 'live'`);
      expect(row.rows[0]?.license_key).toBe(live.prior);
      await expect(
        apply(second, live, operation, 'test-request', 'synthetic-live-next'),
      ).rejects.toThrow();
      const revoked = await first.execute(
        sql`select jti from license_jti_revocations where jti = ${live.jti}`,
      );
      expect(revoked.rows).toHaveLength(0);
    });
  },
);
