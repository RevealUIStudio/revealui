/**
 * Marketplace HTTP endpoint tests (R5-L6 pass 9)
 *
 * Tests the actual Hono route handlers via app.request():
 *   GET  /servers               -  list active servers
 *   GET  /servers/:id           -  single server detail
 *   POST /servers               -  publish a new server (auth required)
 *   DELETE /servers/:id         -  unpublish own server (auth required)
 *   POST /servers/:id/invoke    -  x402 payment gate + proxy
 *   POST /connect/onboard       -  Stripe Connect onboarding (auth required)
 *   GET  /connect/return        -  Stripe Connect return callback
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mock factories ─────────────────────────────────────────────────

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockGetClient,
  mockStripeAccountsCreate,
  mockStripeAccountLinksCreate,
  mockStripeTransfersCreate,
  mockStripeConstructor,
  mockBuildPaymentRequired,
  mockEncodePaymentRequired,
  mockVerifyPayment,
} = vi.hoisted(() => {
  const _accountsCreate = vi.fn();
  const _accountLinksCreate = vi.fn();
  const _transfersCreate = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockGetClient: vi.fn(),
    mockStripeAccountsCreate: _accountsCreate,
    mockStripeAccountLinksCreate: _accountLinksCreate,
    mockStripeTransfersCreate: _transfersCreate,
    // Must use function()  -  arrow functions can't be called with `new`
    mockStripeConstructor: vi.fn().mockImplementation(function (this: unknown) {
      return {
        accounts: { create: _accountsCreate },
        accountLinks: { create: _accountLinksCreate },
        transfers: { create: _transfersCreate },
      };
    }),
    mockBuildPaymentRequired: vi.fn(),
    mockEncodePaymentRequired: vi.fn(),
    mockVerifyPayment: vi.fn(),
  };
});

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Auth middleware  -  we inject user via a Hono middleware wrapper instead
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(
    (_opts?: unknown) => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock('../../middleware/x402.js', () => ({
  buildPaymentRequired: mockBuildPaymentRequired,
  encodePaymentRequired: mockEncodePaymentRequired,
  verifyPayment: mockVerifyPayment,
}));

vi.mock('stripe', () => ({
  default: mockStripeConstructor,
}));

// GAP-131: marketplace now uses protectedStripe from @revealui/services
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    accounts: { create: mockStripeAccountsCreate },
    accountLinks: { create: mockStripeAccountLinksCreate },
    transfers: { create: mockStripeTransfersCreate },
  },
}));

// ─── Drizzle mock with per-query result queue ───────────────────────────────

/** Queue of results  -  each db.select() call shifts the next result from here. */
let selectResults: unknown[][] = [];
let insertResults: unknown[][] = [];

/** Create a fresh select chain where the terminal call resolves to queued data. */
function makeSelectChain() {
  const result = selectResults.shift() ?? [];
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    then(
      onFulfilled?: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const result = insertResults.shift() ?? [];
  const chain = {
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ): Promise<unknown> {
      return Promise.resolve(undefined).then(onFulfilled, onRejected);
    },
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

mockDbSelect.mockImplementation(() => makeSelectChain());
mockDbInsert.mockImplementation(() => makeInsertChain());
mockDbUpdate.mockImplementation(() => makeUpdateChain());
mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

mockGetClient.mockReturnValue({
  select: mockDbSelect,
  insert: mockDbInsert,
  update: mockDbUpdate,
  delete: mockDbDelete,
});

vi.mock('@revealui/db', () => ({
  getClient: mockGetClient,
}));

vi.mock('@revealui/db/schema', () => ({
  marketplaceServers: {
    id: 'id',
    name: 'name',
    description: 'description',
    category: 'category',
    tags: 'tags',
    pricePerCallUsdc: 'price_per_call_usdc',
    callCount: 'call_count',
    createdAt: 'created_at',
    status: 'status',
    metadata: 'metadata',
    developerId: 'developer_id',
    stripeAccountId: 'stripe_account_id',
    url: 'url',
    updatedAt: 'updated_at',
  },
  marketplaceTransactions: {
    id: 'id',
    serverId: 'server_id',
    callerId: 'caller_id',
    amountUsdc: 'amount_usdc',
    platformFeeUsdc: 'platform_fee_usdc',
    developerAmountUsdc: 'developer_amount_usdc',
    paymentMethod: 'payment_method',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'created_at',
    stripeTransferId: 'stripe_transfer_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((col) => `asc(${String(col)})`),
  sql: { __esModule: true },
}));

// ─── Import under test ─────────────────────────────────────────────────────

import marketplaceApp from '../marketplace.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

function createApp(user?: UserContext) {
  const app = new Hono<{ Variables: { user: UserContext | undefined } }>();
  app.use('*', async (c, next) => {
    c.set('user', user ?? undefined);
    await next();
  });
  app.route('/', marketplaceApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal error' }, 500);
  });
  return app;
}

const MOCK_USER: UserContext = {
  id: 'user-1',
  email: 'dev@example.com',
  name: 'Test Dev',
  role: 'user',
};

const ADMIN_USER: UserContext = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
};

const MOCK_SERVER = {
  id: 'mcp_abcdef123456',
  name: 'Test MCP Server',
  description: 'A test server for marketplace',
  url: 'https://example.com/rpc',
  category: 'coding',
  tags: ['test'],
  pricePerCallUsdc: '0.005',
  callCount: 10,
  status: 'active',
  metadata: {},
  developerId: 'user-1',
  stripeAccountId: 'acct_test123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function resetMocks() {
  vi.clearAllMocks();
  selectResults = [];
  insertResults = [];

  // getStripeClient() checks this env var before constructing the (mocked) Stripe instance
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

  // Re-wire Stripe constructor (clearAllMocks removes mockImplementation)
  // Must use function()  -  arrow functions can't be called with `new`
  mockStripeConstructor.mockImplementation(function (this: unknown) {
    return {
      accounts: { create: mockStripeAccountsCreate },
      accountLinks: { create: mockStripeAccountLinksCreate },
      transfers: { create: mockStripeTransfersCreate },
    };
  });

  mockDbSelect.mockImplementation(() => makeSelectChain());
  mockDbInsert.mockImplementation(() => makeInsertChain());
  mockDbUpdate.mockImplementation(() => makeUpdateChain());
  mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

  mockGetClient.mockReturnValue({
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  });

  // Default: Stripe mocks
  mockStripeAccountsCreate.mockResolvedValue({ id: 'acct_new123' });
  mockStripeAccountLinksCreate.mockResolvedValue({
    url: 'https://connect.stripe.com/setup/test',
  });
  mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_test123' });

  // Default: x402 mocks
  mockBuildPaymentRequired.mockReturnValue({
    x402Version: 1,
    accepts: [{ maxAmountRequired: '5000' }],
  });
  mockEncodePaymentRequired.mockReturnValue('base64encoded');
  mockVerifyPayment.mockResolvedValue({ valid: true });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  response shapes vary per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /servers  -  list active servers', () => {
  beforeEach(resetMocks);

  it('returns 200 with servers array', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.servers).toHaveLength(1);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('returns empty array when no active servers', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.servers).toEqual([]);
  });

  it('respects category query filter', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?category=data');
    expect(res.status).toBe(200);
  });

  it('caps limit at 100', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?limit=999');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.limit).toBe(100);
  });

  it('defaults offset to 0 for non-numeric values', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?offset=abc');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.offset).toBe(0);
  });
});

describe('GET /servers/:id  -  single server detail', () => {
  beforeEach(resetMocks);

  it('returns 200 with server detail for active server', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.server.id).toBe('mcp_abcdef123456');
  });

  it('returns 404 when server not found', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers/mcp_notfound1234');
    expect(res.status).toBe(404);
  });

  it('returns 404 for suspended server', async () => {
    selectResults.push([{ ...MOCK_SERVER, status: 'suspended' }]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error).toContain('not available');
  });

  it('rejects malformed server ID', async () => {
    const app = createApp();
    const res = await app.request('/servers/bad-id');
    // OpenAPI param validation rejects the ID
    expect(res.status).toBe(400);
  });
});

describe('POST /servers  -  publish server (auth required)', () => {
  beforeEach(resetMocks);

  it('returns 401 when no user is set', async () => {
    const app = createApp(); // no user
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Server',
        description: 'A great MCP server for testing',
        url: 'https://example.com/rpc',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 201 on successful publish', async () => {
    insertResults.push([MOCK_SERVER]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Server',
        description: 'A great MCP server for testing',
        url: 'https://example.com/rpc',
        category: 'coding',
        tags: ['test'],
        pricePerCallUsdc: '0.005',
      }),
    });
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.server).toBeDefined();
    expect(body.server.id).toBe(MOCK_SERVER.id);
  });

  it('returns 422 for SSRF-blocked URL (localhost)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Evil Server',
        description: 'Tries to access internal services via localhost',
        url: 'http://localhost:8080/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-blocked URL (private IP)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Evil Server',
        description: 'Tries to access RFC-1918 private addresses',
        url: 'http://192.168.1.1/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-blocked URL (AWS metadata)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Evil Server',
        description: 'Tries to hit AWS metadata endpoint',
        url: 'http://169.254.169.254/latest/meta-data',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for non-HTTP scheme', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Evil Server',
        description: 'Tries to use FTP protocol instead of HTTP',
        url: 'ftp://example.com/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 400 for invalid body (name too short)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ab',
        description: 'Valid description here long enough',
        url: 'https://example.com/rpc',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('applies default category and price when omitted', async () => {
    const created = {
      ...MOCK_SERVER,
      category: 'other',
      pricePerCallUsdc: '0.001',
    };
    insertResults.push([created]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Default Server',
        description: 'A server with default category and price',
        url: 'https://example.com/rpc',
      }),
    });
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.server.category).toBe('other');
    expect(body.server.pricePerCallUsdc).toBe('0.001');
  });
});

describe('DELETE /servers/:id  -  unpublish server', () => {
  beforeEach(resetMocks);

  it('returns 401 when no user is set', async () => {
    const app = createApp(); // no user
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 when owner unpublishes their server', async () => {
    selectResults.push([{ developerId: 'user-1' }]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('returns 403 when non-owner non-admin tries to unpublish', async () => {
    selectResults.push([{ developerId: 'other-user' }]);

    const otherUser: UserContext = { ...MOCK_USER, id: 'user-2' };
    const app = createApp(otherUser);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(403);
  });

  it('allows admin to unpublish any server', async () => {
    selectResults.push([{ developerId: 'other-user' }]);

    const app = createApp(ADMIN_USER);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('returns 404 when server does not exist', async () => {
    selectResults.push([]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers/mcp_zzzzzzzzzzzz', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /servers/:id/invoke  -  x402 payment gate + proxy', () => {
  beforeEach(resetMocks);

  it('returns 402 when no X-PAYMENT-PAYLOAD header is provided', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list' }),
    });
    expect(res.status).toBe(402);
    const body = await parseBody(res);
    expect(body.error).toBe('Payment required');
    expect(body.x402Version).toBe(1);
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('base64encoded');
  });

  it('returns 404 when server is not found or inactive', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 402 when payment verification fails', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({
      valid: false,
      error: 'Payment rejected',
    });

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-PAYLOAD': 'invalid-payment-proof',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list' }),
    });
    expect(res.status).toBe(402);
    const body = await parseBody(res);
    expect(body.error).toContain('Payment rejected');
  });

  it('proxies request and returns 200 on successful payment + proxy', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    // Mock the upstream proxy fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ result: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-PAYLOAD': 'valid-payment-proof',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list' }),
    });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.result).toBe('ok');

    globalThis.fetch = originalFetch;
  });

  it('returns 502 when upstream server is unreachable', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    // Mock upstream fetch failure
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-PAYLOAD': 'valid-payment-proof',
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list' }),
    });
    expect(res.status).toBe(502);
    const body = await parseBody(res);
    expect(body.error).toContain('Upstream server unavailable');

    globalThis.fetch = originalFetch;
  });
});

describe('POST /connect/onboard  -  Stripe Connect onboarding', () => {
  beforeEach(resetMocks);

  it('returns 401 when no user is set', async () => {
    const app = createApp(); // no user
    const res = await app.request('/connect/onboard', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('creates new Stripe Connect account when developer has none', async () => {
    selectResults.push([]); // No existing Connect account

    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/onboard', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.url).toBe('https://connect.stripe.com/setup/test');
    expect(body.stripeAccountId).toBe('acct_new123');
    expect(mockStripeAccountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        email: 'dev@example.com',
      }),
    );
  });

  it('reuses existing Stripe Connect account', async () => {
    selectResults.push([{ stripeAccountId: 'acct_existing' }]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/onboard', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.stripeAccountId).toBe('acct_existing');
    // Should NOT create a new account
    expect(mockStripeAccountsCreate).not.toHaveBeenCalled();
  });
});

describe('GET /connect/return  -  Stripe Connect return', () => {
  beforeEach(resetMocks);

  it('returns success message', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/return');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Stripe Connect onboarding complete');
  });
});
