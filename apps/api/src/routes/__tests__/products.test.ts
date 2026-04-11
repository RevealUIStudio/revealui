/**
 * Product API Route Tests
 *
 * Covers Products CRUD endpoints.
 * Critical focus: authentication enforcement, admin-only writes,
 * and published-only visibility for public/non-admin users.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted to the top of the file by Vitest before any
// const/let declarations are initialized (temporal dead zone). Use vi.hoisted()
// so the mock objects are created in the same hoisted scope as the factories.

const { mockProductQueries } = vi.hoisted(() => ({
  mockProductQueries: {
    getAllProducts: vi.fn(),
    countProducts: vi.fn(),
    createProduct: vi.fn(),
    getProductById: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
  },
}));

vi.mock('@revealui/db/queries/products', () => mockProductQueries);
vi.mock('@revealui/db/schema/products', () => ({
  PRODUCT_STATUSES: ['draft', 'published', 'archived'],
}));
vi.mock('../../lib/type-guards.js', () => ({
  asNonEmptyTuple: <T>(values: readonly T[]): [T, ...T[]] => values as [T, ...T[]],
}));

// ─── Import under test ──────────────────────────────────────────────────────

import productsApp from '../content/products.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserCtx {
  id: string;
  role: string;
  email?: string;
}

const ADMIN: UserCtx = { id: 'admin-1', role: 'admin', email: 'admin@example.com' };
const USER_A: UserCtx = { id: 'user-a', role: 'user' };

/** Build a test app that injects the given user into context and mounts productsApp. */
function createApp(user: UserCtx | null = ADMIN) {
  const app = new Hono<{ Variables: { user: UserCtx | undefined; db: unknown } }>();
  app.use('*', async (c, next) => {
    if (user) c.set('user', user);
    c.set('db', {}); // products.ts passes db to query functions, which are mocked
    await next();
  });
  app.route('/', productsApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'Internal server error' }, 500);
  });
  return app;
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'product-1',
    title: 'Test Product',
    slug: 'test-product',
    description: null,
    priceInCents: 1999,
    currency: 'usd',
    stripeProductId: null,
    stripePriceId: null,
    active: true,
    status: 'draft',
    images: null,
    metadata: null,
    ownerId: ADMIN.id,
    createdAt: new Date('2025-06-01T00:00:00Z'),
    updatedAt: new Date('2025-06-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

// ─── GET /products — list products ───────────────────────────────────────────

describe('GET /products — list products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductQueries.getAllProducts.mockResolvedValue([]);
    mockProductQueries.countProducts.mockResolvedValue(0);
  });

  it('returns 200 with published-only filter for unauthenticated requests', async () => {
    const app = createApp(null);
    const res = await app.request('/products');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockProductQueries.getAllProducts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'published' }),
    );
  });

  it('returns 200 with published-only filter for non-admin user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/products');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockProductQueries.getAllProducts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'published' }),
    );
  });

  it('admin sees all products (no forced status filter)', async () => {
    const app = createApp(ADMIN);
    await app.request('/products');
    expect(mockProductQueries.getAllProducts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: undefined }),
    );
  });

  it('respects pagination params', async () => {
    const app = createApp(ADMIN);
    await app.request('/products?limit=10&offset=20');
    expect(mockProductQueries.getAllProducts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });
});

// ─── POST /products — create product ────────────────────────────────────────

describe('POST /products — create product', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin can create a product and gets 201', async () => {
    const created = makeProduct({ title: 'New Product', slug: 'new-product' });
    mockProductQueries.createProduct.mockResolvedValue(created);
    const app = createApp(ADMIN);
    const res = await app.request('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Product', slug: 'new-product' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('New Product');
    // Verify ownerId is set to the authenticated user
    expect(mockProductQueries.createProduct).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerId: ADMIN.id }),
    );
  });

  it('returns 403 for non-admin user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Product', slug: 'new-product' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const app = createApp(null);
    const res = await app.request('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Product', slug: 'new-product' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /products/:id — get product by ID ──────────────────────────────────

describe('GET /products/:id — get product by ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('public can see a published product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(makeProduct({ status: 'published' }));
    const app = createApp(null);
    const res = await app.request('/products/product-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('product-1');
  });

  it('public gets 404 for non-published product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(makeProduct({ status: 'draft' }));
    const app = createApp(null);
    const res = await app.request('/products/product-1');
    expect(res.status).toBe(404);
  });

  it('non-admin gets 404 for non-published product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(makeProduct({ status: 'archived' }));
    const app = createApp(USER_A);
    const res = await app.request('/products/product-1');
    expect(res.status).toBe(404);
  });

  it('admin can see any product regardless of status', async () => {
    mockProductQueries.getProductById.mockResolvedValue(makeProduct({ status: 'draft' }));
    const app = createApp(ADMIN);
    const res = await app.request('/products/product-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('product-1');
  });

  it('returns 404 for non-existent product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(null);
    const app = createApp(ADMIN);
    const res = await app.request('/products/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /products/:id — update product ───────────────────────────────────

describe('PATCH /products/:id — update product', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin can update a product', async () => {
    const existing = makeProduct();
    const updated = makeProduct({ title: 'Updated Product' });
    mockProductQueries.getProductById.mockResolvedValue(existing);
    mockProductQueries.updateProduct.mockResolvedValue(updated);
    const app = createApp(ADMIN);
    const res = await app.request('/products/product-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Product' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Updated Product');
  });

  it('returns 403 for non-admin user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/products/product-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(null);
    const app = createApp(ADMIN);
    const res = await app.request('/products/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /products/:id — delete product ──────────────────────────────────

describe('DELETE /products/:id — delete product', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin can delete a product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(makeProduct());
    mockProductQueries.deleteProduct.mockResolvedValue(undefined);
    const app = createApp(ADMIN);
    const res = await app.request('/products/product-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('Product deleted');
  });

  it('returns 403 for non-admin user', async () => {
    const app = createApp(USER_A);
    const res = await app.request('/products/product-1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent product', async () => {
    mockProductQueries.getProductById.mockResolvedValue(null);
    const app = createApp(ADMIN);
    const res = await app.request('/products/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
