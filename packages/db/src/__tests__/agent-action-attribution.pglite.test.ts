import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
        ALTER TABLE agent_actions ADD COLUMN result jsonb;`);
      await claimDb.query('UPDATE agent_actions SET result = $1 WHERE id = $2', [
        JSON.stringify({ status: { state: 'pending-payment' }, binding: 'trusted-agent-input' }),
        'task-claim',
      ]);
      const continueUnpaid = (actor: string, account: string, binding: string) =>
        claimDb.query<{ id: string }>(
          `UPDATE agent_actions SET status = 'running'
          WHERE id = $1 AND actor_user_id = $2 AND account_id = $3 AND status = 'pending'
            AND result->'status'->>'state' = 'pending-payment' AND result->>'binding' = $4
          RETURNING id`,
          ['task-claim', actor, account, binding],
        );
      expect(
        (await continueUnpaid('foreign-actor', 'account', 'trusted-agent-input')).rows,
      ).toEqual([]);
      expect(
        (await continueUnpaid('actor', 'foreign-account', 'trusted-agent-input')).rows,
      ).toEqual([]);
      expect((await continueUnpaid('actor', 'account', 'changed-agent-input')).rows).toEqual([]);
      const continuations = await Promise.all([
        continueUnpaid('actor', 'account', 'trusted-agent-input'),
        continueUnpaid('actor', 'account', 'trusted-agent-input'),
      ]);
      expect(continuations.flatMap((continuation) => continuation.rows)).toEqual([
        { id: 'task-claim' },
      ]);
      expect((await continueUnpaid('actor', 'account', 'trusted-agent-input')).rows).toEqual([]);
    } finally {
      await claimDb.close();
    }
  }, 30_000);
});
