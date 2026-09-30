/** Real PostgreSQL connections; PGlite cannot prove advisory-lock concurrency. */
import { createHash, randomUUID } from 'node:crypto';
import type { LicenseOperationDescriptor, LicenseOperationResult } from '@revealui/db';
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
    let observer: TestConnection;
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
      observer = createClient({ connectionString: databaseUrl }) as unknown as TestConnection;
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
      await Promise.all([first?.$client.end(), second?.$client.end(), observer?.$client.end()]);
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
      db: Pick<TestConnection, 'execute'>,
      fixture: Awaited<ReturnType<typeof seed>>,
      operation: string,
      fingerprint: string,
      replacement: string,
      descriptor: LicenseOperationDescriptor | null = null,
    ) {
      const result = await db.execute(sql`select license_apply_operation(
      ${operation}::text, ${fingerprint}::text, ${fixture.customer}::text,
      ${fixture.prior}::text, ${fixture.jti}::text, null::timestamptz,
      ${randomUUID()}::text, ${replacement}::text, 'pro'::text, null::timestamptz, true, ${fixture.mode}::text,
      ${randomUUID()}::text, ${descriptor ? JSON.stringify(descriptor) : null}::jsonb
    ) as license_key`);
      return result.rows[0]?.license_key as LicenseOperationResult;
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
      expect(row.rows[0]?.license_key).toBe(winner.value.licenseKey);
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
      expect(results[0]).toEqual(results[1]);
      const operations = await first.execute(
        sql`select operation_id from license_operations where customer_id = ${fixture.customer}`,
      );
      expect(operations.rows).toHaveLength(1);
      await expect(
        apply(second, fixture, operation, 'changed-request', 'synthetic-attempt-c'),
      ).rejects.toThrow();
    });

    it('serializes immutable descriptors and recovery across independent backends', async () => {
      const fixture = await seed();
      const operationId = randomUUID();
      const digest = createHash('sha256').update(fixture.prior).digest('hex');
      const grant = {
        tier: 'pro' as const,
        domains: null,
        maxSites: 5,
        maxUsers: null,
        perpetual: true,
        expiresInSeconds: null,
      };
      const descriptor: LicenseOperationDescriptor = {
        version: 1,
        operationId,
        customerId: fixture.customer,
        mode: fixture.mode,
        grant,
        effectiveGrant: grant,
        action: 'rotation',
        expectedCurrentLicenseKeySha256: digest,
        promotion: {
          kind: 'rotation',
          path: `forge/customers/${fixture.customer}/license-key`,
          expected: { kind: 'sha256', sha256: digest },
        },
      };
      const changed = {
        ...descriptor,
        promotion: { ...descriptor.promotion, path: 'revealui/dev/founder-license-key' },
      };
      const outcomes = await Promise.allSettled([
        apply(first, fixture, operationId, 'descriptor-request', 'descriptor-token-a', descriptor),
        apply(second, fixture, operationId, 'descriptor-request', 'descriptor-token-b', changed),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      const loser = outcomes.find((outcome) => outcome.status === 'rejected');
      const failure: unknown = loser?.reason;
      expect(String(failure instanceof Error ? (failure.cause ?? failure) : failure)).toContain(
        'license_operation_conflict',
      );
      const winner = outcomes.find((outcome) => outcome.status === 'fulfilled');
      if (winner?.status !== 'fulfilled' || !winner.value.operation)
        throw new Error('No committed descriptor');
      const stored = winner.value.operation;
      const selector = {
        version: 1,
        recoverOnly: true,
        grant: stored.grant,
        action: stored.action,
        promotion: { kind: stored.promotion.kind, path: stored.promotion.path },
      };
      const recovered = await second.execute(sql`select license_apply_operation(
        ${operationId}::text, ''::text, ${fixture.customer}::text,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${fixture.mode}::text, NULL,
        ${JSON.stringify(selector)}::jsonb) as receipt`);
      expect(recovered.rows[0]?.receipt).toEqual(winner.value);
      const changedSelector = { ...selector, grant: { ...selector.grant, maxSites: 6 } };
      await expect(
        first.execute(sql`select license_apply_operation(
        ${operationId}::text, ''::text, ${fixture.customer}::text,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${fixture.mode}::text, NULL,
        ${JSON.stringify(changedSelector)}::jsonb)`),
      ).rejects.toThrow();
      const count = await first.execute(sql`select operation_id from license_operations
        where customer_id = ${fixture.customer}`);
      expect(count.rows).toHaveLength(1);

      // Hold the writer's real transaction until the reader is observed waiting
      // on its advisory lock. The barrier is database state, not a sleep ordering.
      const held = await seed();
      const heldOperation = randomUUID();
      const heldDigest = createHash('sha256').update(held.prior).digest('hex');
      const heldDescriptor: LicenseOperationDescriptor = {
        ...descriptor,
        operationId: heldOperation,
        customerId: held.customer,
        expectedCurrentLicenseKeySha256: heldDigest,
        promotion: {
          ...descriptor.promotion,
          path: `forge/customers/${held.customer}/license-key`,
          expected: { kind: 'sha256', sha256: heldDigest },
        },
      };
      let signalWritten!: () => void;
      let releaseWriter!: () => void;
      const written = new Promise<void>((resolve) => {
        signalWritten = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseWriter = resolve;
      });
      const writer = first.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
        const receipt = await apply(
          tx,
          held,
          heldOperation,
          'held-request',
          'held-token',
          heldDescriptor,
        );
        signalWritten();
        await release;
        return receipt;
      });
      // Propagate writer failure to the barrier instead of waiting forever.
      const ready = Promise.race([
        written,
        writer.then(() => {
          throw new Error('Writer ended before barrier');
        }),
      ]);
      let reader: Promise<unknown> | undefined;
      try {
        await ready;
        let signalReader!: (pid: unknown) => void;
        const readerPid = new Promise<unknown>((resolve) => {
          signalReader = resolve;
        });
        const heldSelector = {
          ...selector,
          promotion: { kind: 'rotation', path: heldDescriptor.promotion.path },
        };
        reader = second.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
          const backend = await tx.execute(sql`select pg_backend_pid() as pid`);
          signalReader(backend.rows[0]?.pid);
          const result = await tx.execute(sql`select license_apply_operation(
            ${heldOperation}::text, ''::text, ${held.customer}::text,
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${held.mode}::text, NULL,
            ${JSON.stringify(heldSelector)}::jsonb) as receipt`);
          return result.rows[0]?.receipt;
        });
        const pid = await Promise.race([
          readerPid,
          reader.then(() => {
            throw new Error('Reader ended before barrier');
          }),
        ]);
        let blocked = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const state = await observer.execute(
            sql`select wait_event_type, wait_event from pg_stat_activity where pid = ${pid}::integer`,
          );
          if (
            state.rows[0]?.wait_event_type === 'Lock' &&
            state.rows[0]?.wait_event === 'advisory'
          ) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blocked).toBe(true);
        releaseWriter();
        expect(await reader).toEqual(await writer);
      } finally {
        releaseWriter();
        await Promise.allSettled([writer, reader]);
      }
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
