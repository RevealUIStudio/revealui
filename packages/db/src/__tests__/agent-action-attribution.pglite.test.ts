import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agentActions } from '../schema/agents.js';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
});
afterAll(async () => {
  await db.close();
});

describe('agent action attribution migration', () => {
  it('retains legacy rows unattributed and cannot downgrade deleted accounts to personal receipts', async () => {
    await db.exec(`CREATE TABLE users (id text PRIMARY KEY);
        CREATE TABLE accounts (id text PRIMARY KEY);
        CREATE TABLE agent_actions (id text PRIMARY KEY);
        INSERT INTO users VALUES ('actor'); INSERT INTO accounts VALUES ('account');
        INSERT INTO agent_actions VALUES ('legacy');`);
    const migration = await readFile(
      new URL('../../migrations/0048_agent_action_attribution.sql', import.meta.url),
      'utf8',
    );
    await db.exec(migration);
    await db.exec(migration);
    expect((await db.query('SELECT actor_user_id, account_id FROM agent_actions')).rows).toEqual([
      { actor_user_id: null, account_id: null },
    ]);
    await db.exec(`INSERT INTO agent_actions VALUES ('owned', 'actor', 'account');
        INSERT INTO agent_actions VALUES ('personal', 'actor', NULL);
        DELETE FROM accounts WHERE id = 'account';`);
    expect((await db.query('SELECT id FROM agent_actions ORDER BY id')).rows).toEqual([
      { id: 'legacy' },
      { id: 'personal' },
    ]);
    await db.exec("DELETE FROM users WHERE id = 'actor'");
    expect(
      (await db.query("SELECT actor_user_id FROM agent_actions WHERE id = 'personal'")).rows,
    ).toEqual([{ actor_user_id: null }]);
  });

  it('allows one atomic task claim and unpaid continuation without foreign scope access', async () => {
    const claimDb = new PGlite();
    try {
      await claimDb.waitReady;
      await claimDb.exec(`CREATE TABLE users (id text PRIMARY KEY);
        CREATE TABLE accounts (id text PRIMARY KEY);
        CREATE TABLE agent_actions (id text PRIMARY KEY);
        INSERT INTO users VALUES ('actor'), ('foreign-actor');
        INSERT INTO accounts VALUES ('account'), ('foreign-account');`);
      const migration = await readFile(
        new URL('../../migrations/0048_agent_action_attribution.sql', import.meta.url),
        'utf8',
      );
      await claimDb.exec(migration);
      const reserve = () =>
        claimDb.query<{ id: string }>(
          'INSERT INTO agent_actions (id, actor_user_id, account_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING id',
          ['task-claim', 'actor', 'account'],
        );
      const claims = await Promise.all([reserve(), reserve()]);
      expect(claims.flatMap((claim) => claim.rows)).toEqual([{ id: 'task-claim' }]);
      const owned = (actor: string, account: string) =>
        claimDb.query(
          'SELECT id FROM agent_actions WHERE id = $1 AND actor_user_id = $2 AND account_id = $3',
          ['task-claim', actor, account],
        );
      expect((await owned('actor', 'account')).rows).toEqual([{ id: 'task-claim' }]);
      expect((await owned('foreign-actor', 'account')).rows).toEqual([]);
      expect((await owned('actor', 'foreign-account')).rows).toEqual([]);
      await claimDb.exec(`ALTER TABLE agent_actions ADD COLUMN status text NOT NULL DEFAULT 'pending';
        ALTER TABLE agent_actions ADD COLUMN result jsonb;
        ALTER TABLE agent_actions ADD COLUMN params jsonb;
        ALTER TABLE agent_actions ADD COLUMN tool text;
        ALTER TABLE agent_actions ADD COLUMN version integer DEFAULT 1;`);
      const payload = {
        request: { message: 'Run' },
        binding: {
          agentId: 'trusted-agent',
          inputDigest: 'trusted-agent-input',
          definitionDigest: 'trusted-definition',
        },
      };
      const pending = {
        id: 'task-claim',
        metadata: { pricing: { usdc: '0.001' } },
        status: { timestamp: '2026-10-02T00:00:00.000Z', state: 'pending-payment' },
      };
      await claimDb.query(
        "UPDATE agent_actions SET params = $1::jsonb, result = $2::jsonb, tool = 'tasks/send', version = 2 WHERE id = 'task-claim'",
        [JSON.stringify(payload), JSON.stringify(pending)],
      );
      const client = drizzle(claimDb);
      const continueUnpaid = (actor: string, account: string, binding: string) =>
        client
          .update(agentActions)
          .set({ status: 'running' })
          .where(
            and(
              eq(agentActions.id, 'task-claim'),
              eq(agentActions.actorUserId, actor),
              eq(agentActions.accountId, account),
              eq(agentActions.version, 2),
              inArray(agentActions.tool, ['tasks/send', 'tasks/sendSubscribe']),
              eq(agentActions.status, 'pending'),
              eq(agentActions.params, {
                binding: { ...payload.binding, inputDigest: binding },
                request: payload.request,
              }),
              eq(agentActions.result, {
                status: { state: 'pending-payment', timestamp: pending.status.timestamp },
                metadata: pending.metadata,
                id: 'task-claim',
              }),
            ),
          )
          .returning({ id: agentActions.id });
      expect(await continueUnpaid('foreign-actor', 'account', 'trusted-agent-input')).toEqual([]);
      expect(await continueUnpaid('actor', 'foreign-account', 'trusted-agent-input')).toEqual([]);
      expect(await continueUnpaid('actor', 'account', 'changed-agent-input')).toEqual([]);
      await claimDb.exec("UPDATE agent_actions SET version = 1 WHERE id = 'task-claim'");
      expect(await continueUnpaid('actor', 'account', 'trusted-agent-input')).toEqual([]);
      await claimDb.exec("UPDATE agent_actions SET version = 2 WHERE id = 'task-claim'");
      const continuations = await Promise.all([
        continueUnpaid('actor', 'account', 'trusted-agent-input'),
        continueUnpaid('actor', 'account', 'trusted-agent-input'),
      ]);
      expect(continuations.flat()).toEqual([{ id: 'task-claim' }]);
      expect(await continueUnpaid('actor', 'account', 'trusted-agent-input')).toEqual([]);
    } finally {
      await claimDb.close();
    }
  }, 30_000);
});
