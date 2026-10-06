import { PGlite } from '@electric-sql/pglite';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getRestClient } from '../client/index.js';
import { getConversationById, getConversations, getMessages } from '../queries/conversations.js';
import { getAllOrders } from '../queries/orders.js';
import { conversations, messages } from '../schema/agents.js';
import { orders } from '../schema/products.js';

const mocks = vi.hoisted(() => ({ getRestClient: vi.fn() }));
vi.mock('../client/index.js', () => ({ getRestClient: mocks.getRestClient }));

const client = new PGlite();
const database = drizzle(client);
// Conversation queries currently have an untyped database contract. Validate
// their results at the test boundary rather than asserting an array type.
const rowsWithIds = z.array(z.object({ id: z.string() }));
const expectedIds = Array.from(
  { length: 501 },
  (_, index) => `a-${String(index + 1).padStart(4, '0')}`,
);

beforeAll(async () => {
  // Read-query fixture: real column types, no claim about migration/FK behavior.
  for (const table of [conversations, messages, orders]) {
    const columns = Object.values(getTableColumns(table)).map(
      (column) => `"${column.name}" ${column.getSQLType()}`,
    );
    await client.exec(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`);
  }
});
beforeEach(async () => {
  mocks.getRestClient.mockReturnValue(database);
  await client.exec(`
    TRUNCATE conversations, messages, orders;
    INSERT INTO conversations (id, user_id, status, created_at, updated_at)
    SELECT 'a-' || lpad(i::text, 4, '0'), 'user-a', 'active',
      '2026-01-01', '2026-01-01' FROM generate_series(501, 1, -1) i;
    INSERT INTO conversations (id, user_id, status, created_at, updated_at)
    VALUES ('b-private', 'user-b', 'active', '2026-01-01', '2026-01-01'),
      ('a-archived', 'user-a', 'archived', '2026-02-01', '2026-02-01'),
      ('a-ended', 'user-a', 'ended', '2026-02-01', '2026-02-01');
    INSERT INTO orders (id, customer_id, status, created_at, updated_at)
    SELECT 'a-' || lpad(i::text, 4, '0'), 'user-a', 'confirmed',
      '2026-01-01', '2026-01-01' FROM generate_series(501, 1, -1) i;
    INSERT INTO orders (id, customer_id, status, created_at, updated_at)
    VALUES ('b-private', 'user-b', 'confirmed', '2026-01-01', '2026-01-01'),
      ('a-pending', 'user-a', 'pending', '2026-02-01', '2026-02-01');
    INSERT INTO messages (id, conversation_id, role, content, timestamp)
    SELECT 'a-' || lpad(i::text, 4, '0'), 'a-0001', 'user', 'Synthetic',
      '2026-01-01' FROM generate_series(501, 1, -1) i;
    INSERT INTO messages (id, conversation_id, role, content, timestamp)
    VALUES ('b-private', 'b-private', 'user', 'Other user', '2026-01-01');
  `);
});
afterAll(() => client.close());

describe('owned lists with unchanged equal-time rows', () => {
  it('returns every order once while preserving customer and status filters', async () => {
    const ids: string[] = [];
    for (let offset = 0; offset < 501; offset += 100) {
      const rows = await getAllOrders(getRestClient(), {
        customerId: 'user-a',
        status: 'confirmed',
        limit: 100,
        offset,
      });
      ids.push(...rows.map((row) => row.id));
    }
    expect.soft(ids).toHaveLength(501);
    expect.soft(new Set(ids).size).toBe(501);
    expect(ids).toEqual(expectedIds);
    const other = await getAllOrders(getRestClient(), { customerId: 'user-b' });
    expect(other.map((row) => row.id)).toEqual(['b-private']);
  });
  it('returns every active conversation once while preserving owner and status filters', async () => {
    const ids: string[] = [];
    for (let offset = 0; offset < 501; offset += 100) {
      const rows = rowsWithIds.parse(
        await getConversations(getRestClient(), 'user-a', { limit: 100, offset }),
      );
      ids.push(...rows.map((row) => row.id));
    }
    expect.soft(ids).toHaveLength(501);
    expect.soft(new Set(ids).size).toBe(501);
    expect(ids).toEqual(expectedIds);
    const other = rowsWithIds.parse(await getConversations(getRestClient(), 'user-b'));
    expect(other.map((row) => row.id)).toEqual(['b-private']);
  });
  it('returns every message once after the caller establishes conversation ownership', async () => {
    expect(await getConversationById(getRestClient(), 'a-0001', 'user-a')).not.toBeNull();
    expect(await getConversationById(getRestClient(), 'a-0001', 'user-b')).toBeNull();
    const ids: string[] = [];
    for (let offset = 0; offset < 501; offset += 100) {
      const rows = rowsWithIds.parse(
        await getMessages(getRestClient(), 'a-0001', { limit: 100, offset }),
      );
      ids.push(...rows.map((row) => row.id));
    }
    expect.soft(ids).toHaveLength(501);
    expect.soft(new Set(ids).size).toBe(501);
    expect(ids).toEqual(expectedIds);
  });
  it('keeps descending order creation time ahead of the ID tie-break', async () => {
    const rows = await getAllOrders(getRestClient(), { customerId: 'user-a', limit: 2 });
    expect(rows.map((row) => row.id)).toEqual(['a-pending', 'a-0001']);
  });
  it('keeps descending conversation update time ahead of the ID tie-break', async () => {
    await client.exec("UPDATE conversations SET updated_at = '2026-02-01' WHERE id = 'a-0501'");
    const rows = rowsWithIds.parse(await getConversations(getRestClient(), 'user-a', { limit: 2 }));
    expect(rows.map((row) => row.id)).toEqual(['a-0501', 'a-0001']);
  });
  it('keeps ascending message time ahead of the ID tie-break', async () => {
    await client.exec("UPDATE messages SET timestamp = '2025-12-01' WHERE id = 'a-0501'");
    const rows = rowsWithIds.parse(await getMessages(getRestClient(), 'a-0001', { limit: 2 }));
    expect(rows.map((row) => row.id)).toEqual(['a-0501', 'a-0001']);
  });
});
