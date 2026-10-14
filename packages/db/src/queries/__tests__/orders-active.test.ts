import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({ getRestClient: vi.fn() }));
vi.mock('../../client/index.js', () => ({ getRestClient: mocks.getRestClient }));

import { getRestClient } from '../../client/index.js';
import { countOrders, getAllOrders, getOrderById, updateOrder } from '../orders.js';

const client = new PGlite();
const database = drizzle(client);
const idsSchema = z.array(z.object({ id: z.string() }));

beforeAll(async () => {
  await client.exec(`
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE orders (
      id text PRIMARY KEY,
      customer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
      total_in_cents integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'usd',
      stripe_payment_intent_id text,
      stripe_checkout_session_id text,
      items jsonb NOT NULL DEFAULT '[]'::jsonb,
      shipping_address jsonb,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
});

beforeEach(async () => {
  mocks.getRestClient.mockReturnValue(database);
  await client.exec(`
    TRUNCATE orders, users;
    INSERT INTO users (id) VALUES ('user-a'), ('user-b');
    INSERT INTO orders (id, customer_id, status, total_in_cents, currency, created_at, updated_at, deleted_at)
    VALUES
      ('active-a', 'user-a', 'confirmed', 1250, 'usd', '2026-01-01', '2026-01-01', NULL),
      ('deleted-a', 'user-a', 'confirmed', 2500, 'usd', '2026-01-02', '2026-01-02', '2026-01-03'),
      ('active-b', 'user-b', 'pending', 500, 'usd', '2026-01-04', '2026-01-04', NULL);
  `);
});

afterAll(() => client.close());

describe('active order query contract', () => {
  it('filters soft-deleted rows from owner lists and counts', async () => {
    const rows = idsSchema.parse(await getAllOrders(getRestClient(), { customerId: 'user-a' }));

    expect(rows.map((row) => row.id)).toEqual(['active-a']);
    expect(await countOrders(getRestClient(), { customerId: 'user-a' })).toBe(1);
    expect(await countOrders(getRestClient())).toBe(2);
  });

  it('hides soft-deleted detail rows and returns active details', async () => {
    expect(await getOrderById(getRestClient(), 'deleted-a')).toBeNull();
    expect(await getOrderById(getRestClient(), 'active-a')).toMatchObject({ id: 'active-a' });
  });

  it('updates active rows but never modifies soft-deleted rows', async () => {
    const active = await updateOrder(getRestClient(), 'active-a', { status: 'cancelled' });
    expect(active?.status).toBe('cancelled');
    expect(await updateOrder(getRestClient(), 'deleted-a', { status: 'cancelled' })).toBeNull();

    const rows = await client.query("SELECT status FROM orders WHERE id = 'deleted-a'");
    expect(z.array(z.object({ status: z.string() })).parse(rows.rows)[0]?.status).toBe('confirmed');
  });
});
