// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { RevealUICollection } from '@revealui/core';
import type { QueryableDatabaseAdapter } from '@revealui/core/types';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversations } from '@/lib/collections/Conversations';
import { conversations } from '../../../../../../packages/db/src/schema/agents';
import { createTypedCollectionStorage } from '../typedCollectionStorage';

const { getRestClient } = vi.hoisted(() => ({ getRestClient: vi.fn() }));
vi.mock('@revealui/db/client', () => ({ getRestClient }));

const client = new PGlite();
const database = drizzle(client);
const dynamicQuery = vi.fn(async () => ({ rows: [], rowCount: 0 }));
const request = { user: { id: 'user-a', email: 'a@example.com' } };

function revealDatabase(): QueryableDatabaseAdapter {
  return { query: dynamicQuery, collectionStorage: createTypedCollectionStorage() };
}

beforeAll(async () => {
  await client.exec(`
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE conversations (
      id text PRIMARY KEY,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id text NOT NULL,
      title text,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'ended')),
      device_id text,
      last_synced_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE messages (
      id text PRIMARY KEY,
      conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE
    );
    INSERT INTO users (id) VALUES ('user-a'), ('user-b');
  `);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('POSTGRES_URL', 'postgresql://synthetic.invalid/test');
  getRestClient.mockReturnValue(database);
  await client.exec('TRUNCATE messages, conversations');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('conversation collection typed writes', () => {
  it('creates a canonical row and lets the database own version and timestamps', async () => {
    const collection = new RevealUICollection(Conversations, revealDatabase());
    const created = await collection.create({
      data: { userId: 'user-a', agentId: 'agent-a', title: 'New thread' },
      req: request,
    });

    expect(String(created.id).startsWith('rvl_')).toBe(true);
    expect(created.version).toBe(1);
    expect(created.title).toBe('New thread');
    expect(created.status).toBe('active');
    expect(created.createdAt).toEqual(expect.any(String));
    expect(created.updatedAt).toEqual(expect.any(String));
    expect(dynamicQuery).not.toHaveBeenCalled();
  });

  it('rejects invalid and undeclared values before persistence', async () => {
    const collection = new RevealUICollection(Conversations, revealDatabase());

    await expect(
      collection.create({
        data: { userId: 'user-a', agentId: 'agent-a', status: 'pending' },
        req: request,
      }),
    ).rejects.toThrow();
    await expect(
      collection.create({
        data: { userId: 'user-a', agentId: 'agent-a', unexpected: true },
        req: request,
      }),
    ).rejects.toThrow();

    expect(await database.select().from(conversations)).toHaveLength(0);
    expect(dynamicQuery).not.toHaveBeenCalled();
  });

  it('increments the version, detects stale updates, and protects owner scope', async () => {
    await client.exec(`
      INSERT INTO conversations (id, user_id, agent_id, title)
      VALUES ('conversation-a', 'user-a', 'agent-a', 'Before')
    `);
    const collection = new RevealUICollection(Conversations, revealDatabase());
    const updated = await collection.update({
      id: 'conversation-a',
      data: { version: 1, title: 'After', status: 'archived' },
      req: request,
    });

    expect(updated.title).toBe('After');
    expect(updated.status).toBe('archived');
    expect(updated.version).toBe(2);
    await expect(
      collection.update({
        id: 'conversation-a',
        data: { version: 1, title: 'Stale' },
        req: request,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      collection.update({
        id: 'conversation-a',
        data: { version: 2, title: 'Unauthorized' },
        req: { user: { id: 'user-b', email: 'b@example.com' } },
      }),
    ).rejects.toThrow('Access denied');
    expect(dynamicQuery).not.toHaveBeenCalled();
  });

  it('deletes through the canonical table, cascades messages, and rejects missing rows', async () => {
    await client.exec(`
      INSERT INTO conversations (id, user_id, agent_id)
      VALUES ('conversation-delete', 'user-a', 'agent-a');
      INSERT INTO messages (id, conversation_id) VALUES ('message-a', 'conversation-delete');
    `);
    const collection = new RevealUICollection(Conversations, revealDatabase());
    const deleted = await collection.delete({ id: 'conversation-delete', req: request });

    expect(deleted.id).toBe('conversation-delete');
    const remainingMessages = await client.query('SELECT id FROM messages');
    expect(remainingMessages.rows).toHaveLength(0);
    await expect(
      collection.delete({ id: 'conversation-delete', req: request, overrideAccess: true }),
    ).rejects.toThrow('conversation not found');
    expect(dynamicQuery).not.toHaveBeenCalled();
  });
});
