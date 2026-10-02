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
});
