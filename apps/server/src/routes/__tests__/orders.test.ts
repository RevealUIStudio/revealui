/**
 * Orders API Route Tests
 *
 * Covers Order CRUD endpoints:
 *   GET /orders          -  List orders (admin: all; authenticated: own orders)
 *   POST /orders         -  Create an order (authenticated)
 *   GET /orders/:id      -  Get order by ID (admin or owner)
 *   PATCH /orders/:id    -  Update order status (admin-only)
 *
 * Critical focus: authentication enforcement and IDOR prevention
 * (non-admin users must not access other users' orders).
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted to the top of the file by Vitest before any
// const/let declarations are initialized (temporal dead zone). Use vi.hoisted()
// so the mock objects are created in the same hoisted scope as the factories.

const { mockOrderQueries } = vi.hoisted(() => ({
  mockOrderQueries: {
    getAllOrders: vi.fn(),
    countOrders: vi.fn(),
    createOrder: vi.fn(),
    getOrderById: vi.fn(),
    updateOrder: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/orders', () => mockOrderQueries);

vi.mock('@revealui/db/schema/products', () => ({
  ORDER_STATUSES: [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ],
}));

vi.mock('../../lib/type-guards.js', () => ({
  asNonEmptyTuple: <T extends string>(values: readonly T[]): [T, ...T[]] => {
    if (values.length === 0) throw new Error('Expected a non-empty array for z.enum()');
    return values as unknown as [T, ...T[]];
  },
}));

// ─── Import under test ────────────────────────────────────────────────────────

import ordersApp from '../content/orders.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
  email?: string;
}

const ADMIN: UserCtx = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
const USER_A: UserCtx = { id: 'user-a', role: 'user' };
const USER_B: UserCtx = { id: 'user-b', role: 'user' };

/** Build a test app that injects the given user into context and mounts ordersApp. */
function createApp(user: UserCtx | null = ADMIN) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {}); // orders.ts passes db to query functions, which are mocked
    await next();
  });
  app.route('/', ordersApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    customerId: USER_A.id,
    status: 'pending',
    totalInCents: 2500,
    currency: 'usd',
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    items: [{ productId: 'prod-1', title: 'Widget', quantity: 2, priceInCents: 1250 }],
    shippingAddress: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── GET /orders ──────────────────────────────────────────────────────────────

describe('GET /orders  -  list orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderQueries.getAllOrders.mockResolvedValue([]);
    mockOrderQueries.countOrders.mockResolvedValue(0);
  });

  it('admin sees all orders (no customerId filter)', async () => {
    const app = createApp(ADMIN);
    const res = await app.request('/orders');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(mockOrderQueries.getAllOrders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: undefined }),
    );
  });

  it('non-admin user sees only their own orders (customerId = user.id)', async () => {
    const app = createApp(USER_A);
    await app.request('/orders');
    expect(mockOrderQueries.getAllOrders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: USER_A.id }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createApp(null);
    const res = await app.request('/orders');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('respects pagination params (limit & offset)', async () => {
    const app = createApp(ADMIN);
    await app.request('/orders?limit=5&offset=10');
    expect(mockOrderQueries.getAllOrders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 5, offset: 10 }),
    );
  });
});

// ─── POST /orders ─────────────────────────────────────────────────────────────

describe('POST /orders  -  create order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an order with valid items and computes total correctly', async () => {
    const items = [
      { productId: 'prod-1', title: 'Widget', quantity: 2, priceInCents: 1000 },
      { productId: 'prod-2', title: 'Gadget', quantity: 1, priceInCents: 500 },
    ];
    // total = (2 * 1000) + (1 * 500) = 2500
    mockOrderQueries.createOrder.mockImplementation((_db: unknown, data: Record<string, unknown>) =>
      Promise.resolve(
        makeOrder({
          id: data.id,
          customerId: data.customerId,
          items: data.items,
          totalInCents: data.totalInCents,
          currency: data.currency,
        }),
      ),
    );

    const app = createApp(USER_A);
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockOrderQueries.createOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: USER_A.id,
        totalInCents: 2500,
        currency: 'usd',
      }),
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createApp(null);
    const res = await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod-1', title: 'Widget', quantity: 1, priceInCents: 500 }],
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('sets customerId to the authenticated user', async () => {
    mockOrderQueries.createOrder.mockImplementation((_db: unknown, data: Record<string, unknown>) =>
      Promise.resolve(makeOrder({ customerId: data.customerId })),
    );

    const app = createApp(USER_B);
    await app.request('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'prod-1', title: 'Widget', quantity: 1, priceInCents: 1000 }],
      }),
    });

    expect(mockOrderQueries.createOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customerId: USER_B.id }),
    );
  });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────

describe('GET /orders/:id  -  get order by ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin can view any order', async () => {
    const order = makeOrder({ customerId: USER_A.id });
    mockOrderQueries.getOrderById.mockResolvedValue(order);

    const app = createApp(ADMIN);
    const res = await app.request('/orders/order-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('order-1');
  });

  it('user can view their own order', async () => {
    const order = makeOrder({ customerId: USER_A.id });
    mockOrderQueries.getOrderById.mockResolvedValue(order);

    const app = createApp(USER_A);
    const res = await app.request('/orders/order-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('order-1');
  });

  it("user cannot view another user's order (IDOR prevention  -  403)", async () => {
    const order = makeOrder({ customerId: USER_A.id });
    mockOrderQueries.getOrderById.mockResolvedValue(order);

    const app = createApp(USER_B);
    const res = await app.request('/orders/order-1');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 404 for non-existent order', async () => {
    mockOrderQueries.getOrderById.mockResolvedValue(null);

    const app = createApp(ADMIN);
    const res = await app.request('/orders/does-not-exist');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Order not found');
  });
});

// ─── PATCH /orders/:id ───────────────────────────────────────────────────────

describe('PATCH /orders/:id  -  update order status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin can update order status', async () => {
    const existing = makeOrder();
    const updated = makeOrder({ status: 'shipped' });
    mockOrderQueries.getOrderById.mockResolvedValue(existing);
    mockOrderQueries.updateOrder.mockResolvedValue(updated);

    const app = createApp(ADMIN);
    const res = await app.request('/orders/order-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('shipped');
    expect(mockOrderQueries.updateOrder).toHaveBeenCalledWith(
      expect.anything(),
      'order-1',
      expect.objectContaining({ status: 'shipped' }),
    );
  });

  it('non-admin gets 403', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/orders/order-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Admin access required');
  });

  it('returns 404 for non-existent order', async () => {
    mockOrderQueries.getOrderById.mockResolvedValue(null);

    const app = createApp(ADMIN);
    const res = await app.request('/orders/does-not-exist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Order not found');
  });
});
