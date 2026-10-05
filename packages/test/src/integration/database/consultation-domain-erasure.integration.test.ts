/** Real PostgreSQL sessions prove erasure admission; PGlite cannot prove lock contention. */
import { randomUUID } from 'node:crypto';
import { universalPostgresAdapter } from '@revealui/core/database';
import { createClient, type Database, getTransactionContext } from '@revealui/db/client';
import {
  removeConsultationDomain,
  reserveConsultationDomain,
  SiteDomainCleanupRequiredError,
  setConsultationDomain,
} from '@revealui/db/queries/sites';
import { withUserDomainCleanupAdmission } from '@revealui/db/queries/users';
import type * as schema from '@revealui/db/schema';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Connection = NodePgDatabase<typeof schema> & { $client: { end(): Promise<void> } };
const databaseUrl = process.env.TEST_DATABASE_URL;
// The existing fresh-migration CI invocation requires its native PostgreSQL fixture.
const required = process.env.LICENSE_OPERATION_POSTGRES_REQUIRED === 'true';

describe.runIf(required || Boolean(databaseUrl))(
  'consultation domain erasure on independent PostgreSQL sessions',
  () => {
    let admission: Connection;
    let cms: Connection;
    let observer: Connection;
    let connectionString: string;
    let admissionPid: number;
    let cmsPid: number;
    const fixtures: Array<{ siteId: string; ownerId: string; buyerId: string; hostname: string }> =
      [];

    beforeAll(async () => {
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for native domain tests');
      const target = new URL(databaseUrl);
      if (
        !(
          ['postgres:', 'postgresql:'].includes(target.protocol) &&
          !target.search &&
          !target.hash &&
          ['localhost', '127.0.0.1'].includes(target.hostname) &&
          ['/revealui_migrations', '/revealui_test', '/test_revealui'].includes(target.pathname)
        )
      )
        throw new Error('Domain PostgreSQL tests require the maintained loopback test database');
      connectionString = databaseUrl;
      admission = createClient({ connectionString: databaseUrl }) as unknown as Connection;
      cms = createClient({ connectionString: databaseUrl }) as unknown as Connection;
      observer = createClient({ connectionString: databaseUrl }) as unknown as Connection;
      admissionPid = Number(
        (await admission.execute(sql`select pg_backend_pid() as pid`)).rows[0]?.pid,
      );
      cmsPid = Number((await cms.execute(sql`select pg_backend_pid() as pid`)).rows[0]?.pid);
      const observerPid = Number(
        (await observer.execute(sql`select pg_backend_pid() as pid`)).rows[0]?.pid,
      );
      expect(new Set([admissionPid, cmsPid, observerPid]).size).toBe(3);
    });

    afterAll(async () => {
      try {
        if (admission)
          for (const fixture of fixtures) {
            // Synthetic provider fixtures have no external aliases to delete.
            await removeConsultationDomain(
              admission,
              fixture.siteId,
              fixture.ownerId,
              fixture.hostname,
            );
            await admission.execute(
              sql`delete from users where id in (${fixture.ownerId}, ${fixture.buyerId})`,
            );
          }
      } finally {
        await Promise.all([admission?.$client.end(), cms?.$client.end(), observer?.$client.end()]);
      }
    });

    async function seed() {
      const id = randomUUID();
      const fixture = {
        siteId: `native-domain-${id}`,
        ownerId: `native-operator-${id}`,
        buyerId: `native-buyer-${id}`,
        hostname: `native-${id}.customer.com`,
      };
      fixtures.push(fixture);
      await admission.execute(sql`insert into users (id, name, email, status, email_verified, _json)
        values (${fixture.ownerId}, 'Synthetic operator', ${`${fixture.ownerId}@customer.com`},
          'active', true, '{"roles":["super-admin"]}'::jsonb),
          (${fixture.buyerId}, 'Synthetic buyer', ${`${fixture.buyerId}@customer.com`},
          'active', true, '{}'::jsonb)`);
      const settings = {
        consultation: {
          version: 1,
          kind: 'studio-consultation',
          bookingId: id,
          buyerUserId: fixture.buyerId,
        },
        consultationLifecycle: {
          version: 1,
          revoked: false,
          domainPackPurchased: true,
          domainPack: 'entitled',
          amountRefunded: 0,
        },
      };
      await admission.execute(sql`insert into sites (id, owner_id, name, slug, visibility, settings)
        values (${fixture.siteId}, ${fixture.ownerId}, 'Synthetic consultation',
          ${fixture.siteId}, 'private', ${JSON.stringify(settings)}::jsonb)`);
      return fixture;
    }

    const domain = (fixture: Awaited<ReturnType<typeof seed>>) => ({
      hostname: fixture.hostname,
      provider: 'vercel' as const,
      projectId: 'prj_studio',
    });

    async function heldAdvisoryLocks(pid: number) {
      const result = await observer.execute(sql`select count(*)::integer as count
        from pg_locks where pid = ${pid}::integer and locktype = 'advisory' and granted`);
      return Number(result.rows[0]?.count);
    }

    it('deletes through a separate CMS session while admission is held without a user-row deadlock', async () => {
      const fixture = await seed();
      const result = await withUserDomainCleanupAdmission(admission, fixture.ownerId, async () => {
        expect(await heldAdvisoryLocks(admissionPid)).toBeGreaterThan(0);
        // A row lock held by admission would deadlock this independent CMS transaction.
        await cms.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL statement_timeout = '3s'`);
          await tx.execute(sql`delete from users where id = ${fixture.ownerId}`);
        });
        return 'erased';
      });
      expect(result).toBe('erased');
      expect(
        (await observer.execute(sql`select id from users where id = ${fixture.ownerId}`)).rows,
      ).toEqual([]);
      expect(
        (await observer.execute(sql`select id from sites where id = ${fixture.siteId}`)).rows,
      ).toEqual([]);
      expect(await heldAdvisoryLocks(admissionPid)).toBe(0);
    });

    it('shares one leased connection with CMS queries and sibling savepoints when poolMax is one', async () => {
      const fixture = await seed();
      const single = createClient({ connectionString, poolMax: 1 }) as unknown as Connection;
      const pool = single.$client as Parameters<typeof getTransactionContext>[0];
      const adapter = universalPostgresAdapter({ pool, transactionContext: getTransactionContext });
      try {
        await withUserDomainCleanupAdmission(single, fixture.ownerId, async () => {
          const context = getTransactionContext(pool);
          if (!context) throw new Error('Expected active shared transaction context');
          const pid = (await context.connection.query('select pg_backend_pid() as pid')).rows[0]
            ?.pid;
          const sameLease = await adapter.query('select pg_backend_pid() as id');
          expect(sameLease.rows[0]?.id).toBe(pid);
          expect(pool.options.max).toBe(1);
          expect(pool.totalCount).toBe(1);
          expect(pool.waitingCount).toBe(0);
          if (!adapter.transaction) throw new Error('Expected maintained adapter transactions');
          const outcomes = await Promise.allSettled([
            adapter.transaction(async (tx) => {
              await tx.query('UPDATE sites SET name = $1 WHERE id = $2', [
                'rolled back',
                fixture.siteId,
              ]);
              throw new Error('Synthetic savepoint failure');
            }),
            adapter.transaction(async (tx) => {
              await tx.query('UPDATE sites SET name = $1 WHERE id = $2', [
                'retained sibling',
                fixture.siteId,
              ]);
              return 'retained';
            }),
          ]);
          expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'fulfilled']);
          const current = await adapter.query('SELECT id, name FROM sites WHERE id = $1', [
            fixture.siteId,
          ]);
          expect(current.rows[0]?.name).toBe('retained sibling');
          await adapter.query('DELETE FROM users WHERE id = $1 RETURNING id', [fixture.ownerId]);
          expect(pool.waitingCount).toBe(0);
        });
        expect(getTransactionContext(pool)).toBeNull();
        expect(
          (await observer.execute(sql`select id from users where id = ${fixture.ownerId}`)).rows,
        ).toEqual([]);
        expect(
          (await observer.execute(sql`select id from sites where id = ${fixture.siteId}`)).rows,
        ).toEqual([]);
      } finally {
        await single.$client.end();
      }
    });

    it('denies same-owner reservation immediately while another owner remains independent', async () => {
      const fixture = await seed();
      const other = await seed();
      let entered!: () => void;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const erasing = withUserDomainCleanupAdmission(admission, fixture.ownerId, async () => {
        entered();
        await released;
        return 'finished';
      });
      try {
        await Promise.race([
          ready,
          erasing.then(() => {
            throw new Error('Admission ended before barrier');
          }),
        ]);
        expect(await heldAdvisoryLocks(admissionPid)).toBeGreaterThan(0);
        await expect(
          cms.transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL statement_timeout = '3s'`);
            return reserveConsultationDomain(
              tx as unknown as Database,
              fixture.siteId,
              fixture.ownerId,
              domain(fixture),
            );
          }),
        ).rejects.toBeInstanceOf(SiteDomainCleanupRequiredError);
        expect(
          await reserveConsultationDomain(cms, other.siteId, other.ownerId, domain(other)),
        ).not.toBeNull();
        const current = await observer.execute(
          sql`select settings from sites where id = ${fixture.siteId}`,
        );
        expect(current.rows[0]?.settings).not.toHaveProperty('consultationDomainPending');
      } finally {
        release();
        await erasing;
      }
    });

    it.each(['pending', 'verified'])(
      'rejects %s aliases before invoking any erasure callback',
      async (state) => {
        const fixture = await seed();
        await reserveConsultationDomain(
          admission,
          fixture.siteId,
          fixture.ownerId,
          domain(fixture),
        );
        if (state === 'verified')
          await setConsultationDomain(admission, fixture.siteId, fixture.ownerId, {
            ...domain(fixture),
            verifiedAt: new Date().toISOString(),
          });
        let erased = false;
        await expect(
          withUserDomainCleanupAdmission(admission, fixture.ownerId, async () => {
            erased = true;
          }),
        ).rejects.toBeInstanceOf(SiteDomainCleanupRequiredError);
        expect(erased).toBe(false);
        expect(await heldAdvisoryLocks(admissionPid)).toBe(0);
      },
    );

    it('releases failed admission on rollback so attachment and a subsequent erasure can retry', async () => {
      const fixture = await seed();
      await expect(
        withUserDomainCleanupAdmission(admission, fixture.ownerId, async () => {
          expect(await heldAdvisoryLocks(admissionPid)).toBeGreaterThan(0);
          throw new Error('Synthetic erasure failure');
        }),
      ).rejects.toThrow('Synthetic erasure failure');
      expect(await heldAdvisoryLocks(admissionPid)).toBe(0);
      expect(
        await reserveConsultationDomain(cms, fixture.siteId, fixture.ownerId, domain(fixture)),
      ).not.toBeNull();
      await removeConsultationDomain(cms, fixture.siteId, fixture.ownerId, fixture.hostname);
      await expect(
        withUserDomainCleanupAdmission(admission, fixture.ownerId, async () => 'retried'),
      ).resolves.toBe('retried');
    });

    it('waits for an existing reservation transaction and then denies erasure before its callback', async () => {
      const fixture = await seed();
      let reserved!: () => void;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        reserved = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const writer = admission.transaction(async (tx) => {
        await reserveConsultationDomain(
          tx as unknown as Database,
          fixture.siteId,
          fixture.ownerId,
          domain(fixture),
        );
        reserved();
        await released;
      });
      let erased = false;
      let erasing: Promise<unknown> | undefined;
      try {
        await Promise.race([
          ready,
          writer.then(() => {
            throw new Error('Reservation ended before barrier');
          }),
        ]);
        erasing = withUserDomainCleanupAdmission(cms, fixture.ownerId, async () => {
          erased = true;
        });
        // Handle rejection while observing the real lock wait, without hiding its final result.
        void erasing.catch(() => undefined);
        await expect
          .poll(async () => {
            const result = await observer.execute(sql`select wait_event_type, wait_event
            from pg_stat_activity where pid = ${cmsPid}::integer`);
            return (
              result.rows[0]?.wait_event_type === 'Lock' &&
              result.rows[0]?.wait_event === 'advisory'
            );
          })
          .toBe(true);
        release();
        await writer;
        await expect(erasing).rejects.toBeInstanceOf(SiteDomainCleanupRequiredError);
        expect(erased).toBe(false);
      } finally {
        release();
        await Promise.allSettled([writer, erasing]);
      }
    });
  },
);
