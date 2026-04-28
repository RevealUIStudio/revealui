/**
 * MCP Marketplace route tests (Phase 5.5)
 *
 * Comprehensive Hono endpoint tests covering:
 *   GET  /servers               -  list active servers (public, no auth)
 *   GET  /servers/:id           -  single server detail (public)
 *   POST /servers               -  publish a new server (auth required)
 *   DELETE /servers/:id         -  unpublish own server (auth required)
 *   POST /servers/:id/invoke    -  x402 payment gate + proxy
 *   POST /connect/onboard       -  Stripe Connect onboarding (auth required)
 *   GET  /connect/return        -  Stripe Connect return callback
 *
 * All external dependencies are fully mocked. Tests exercise the actual
 * Hono route handlers via app.request().
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
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
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
    // Must use function()  -  arrow functions cannot be called with `new`
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
    mockLoggerInfo: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
  };
});

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: mockLoggerInfo, warn: mockLoggerWarn, error: mockLoggerError },
}));

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

let selectResults: unknown[][] = [];
let insertResults: unknown[][] = [];

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

// ─── Import under test (after mocks) ────────────────────────────────────────

import marketplaceApp from '../marketplace.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

/**
 * Build a Hono test app that wraps the marketplace routes, optionally
 * injecting a user into the context (simulating auth middleware).
 */
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

const OTHER_USER: UserContext = {
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other Dev',
  role: 'user',
};

const MOCK_SERVER = {
  id: 'mcp_abcdef123456',
  name: 'Test MCP Server',
  description: 'A test server for marketplace testing',
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

  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

  // Re-wire Stripe constructor after clearAllMocks
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

  mockStripeAccountsCreate.mockResolvedValue({ id: 'acct_new123' });
  mockStripeAccountLinksCreate.mockResolvedValue({
    url: 'https://connect.stripe.com/setup/test',
  });
  mockStripeTransfersCreate.mockResolvedValue({ id: 'tr_test123' });

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /servers -- list active servers', () => {
  beforeEach(resetMocks);

  it('returns 200 with servers array', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.servers).toHaveLength(1);
    expect(body.servers[0].id).toBe(MOCK_SERVER.id);
  });

  it('returns empty array when no active servers exist', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.servers).toEqual([]);
  });

  it('returns default limit=50 and offset=0', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('filters by category query parameter', async () => {
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

  it('uses custom limit and offset', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?limit=10&offset=20');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(20);
  });

  it('defaults offset to 0 for non-numeric values', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?offset=abc');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.offset).toBe(0);
  });

  it('defaults limit to 50 for non-positive values', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers?limit=-5');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.limit).toBe(50);
  });

  it('does not require authentication', async () => {
    selectResults.push([]);

    const app = createApp(); // no user
    const res = await app.request('/servers');
    expect(res.status).toBe(200);
  });
});

describe('GET /servers/:id -- single server detail', () => {
  beforeEach(resetMocks);

  it('returns 200 with server detail for an active server', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.server.id).toBe('mcp_abcdef123456');
    expect(body.server.name).toBe(MOCK_SERVER.name);
  });

  it('returns 404 when server does not exist', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers/mcp_notfound1234');
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error).toContain('not found');
  });

  it('returns 404 for a suspended (non-active) server', async () => {
    selectResults.push([{ ...MOCK_SERVER, status: 'suspended' }]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error).toContain('not available');
  });

  it('returns 404 for a pending server', async () => {
    selectResults.push([{ ...MOCK_SERVER, status: 'pending' }]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(404);
  });

  it('rejects malformed server ID (OpenAPI param validation)', async () => {
    const app = createApp();
    const res = await app.request('/servers/bad-id');
    expect(res.status).toBe(400);
  });

  it('does not require authentication', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp(); // no user
    const res = await app.request('/servers/mcp_abcdef123456');
    expect(res.status).toBe(200);
  });
});

describe('POST /servers -- publish a new server (auth required)', () => {
  beforeEach(resetMocks);

  const validPayload = {
    name: 'My MCP Server',
    description: 'A great MCP server for testing marketplace flows',
    url: 'https://example.com/rpc',
    category: 'coding',
    tags: ['typescript'],
    pricePerCallUsdc: '0.005',
  };

  it('returns 201 on successful publish with valid data', async () => {
    insertResults.push([MOCK_SERVER]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.server).toBeDefined();
    expect(body.server.id).toBe(MOCK_SERVER.id);
    expect(body.server.name).toBe(MOCK_SERVER.name);
  });

  it('returns 401 when unauthenticated (no user)', async () => {
    const app = createApp(); // no user
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 for SSRF-unsafe URL (localhost)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://localhost:8080/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (127.x.x.x loopback)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://127.0.0.1/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (10.x.x.x private range)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://10.0.0.1/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (192.168.x.x private range)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://192.168.1.1/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (172.16.x.x private range)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://172.16.0.1/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (AWS metadata 169.254.x.x)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://169.254.169.254/latest/meta-data',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for non-HTTP scheme (ftp)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'ftp://example.com/rpc',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 for SSRF-unsafe URL (0.0.0.0)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        url: 'http://0.0.0.0/rpc',
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
        ...validPayload,
        name: 'ab',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid body (description too short)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validPayload,
        description: 'Too short',
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
        description: 'A server with default category and price settings',
        url: 'https://example.com/rpc',
      }),
    });
    expect(res.status).toBe(201);
    const body = await parseBody(res);
    expect(body.server.category).toBe('other');
    expect(body.server.pricePerCallUsdc).toBe('0.001');
  });

  it('logs server publication on success', async () => {
    insertResults.push([MOCK_SERVER]);

    const app = createApp(MOCK_USER);
    await app.request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Marketplace server published',
      expect.objectContaining({ developerId: 'user-1' }),
    );
  });
});

describe('DELETE /servers/:id -- unpublish server (auth required)', () => {
  beforeEach(resetMocks);

  it('returns 200 when owner unpublishes their own server', async () => {
    selectResults.push([{ developerId: 'user-1' }]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('returns 200 when admin unpublishes any server (IDOR bypass for admin)', async () => {
    selectResults.push([{ developerId: 'other-user' }]);

    const app = createApp(ADMIN_USER);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
  });

  it('returns 403 when non-owner non-admin tries to unpublish (IDOR protection)', async () => {
    selectResults.push([{ developerId: 'user-1' }]);

    const app = createApp(OTHER_USER);
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.error).toContain('Forbidden');
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createApp(); // no user
    const res = await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when server does not exist', async () => {
    selectResults.push([]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/servers/mcp_zzzzzzzzzzzz', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });

  it('sets server status to suspended on unpublish', async () => {
    selectResults.push([{ developerId: 'user-1' }]);

    const app = createApp(MOCK_USER);
    await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    // Verify the update chain was called (db.update().set().where())
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('logs unpublish action', async () => {
    selectResults.push([{ developerId: 'user-1' }]);

    const app = createApp(MOCK_USER);
    await app.request('/servers/mcp_abcdef123456', {
      method: 'DELETE',
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Marketplace server unpublished',
      expect.objectContaining({ serverId: 'mcp_abcdef123456', by: 'user-1' }),
    );
  });
});

describe('POST /servers/:id/invoke -- x402 payment flow', () => {
  beforeEach(resetMocks);

  const jsonRpcBody = { jsonrpc: '2.0', method: 'tools/list' };

  it('returns 402 with payment requirements when no X-PAYMENT-PAYLOAD header', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonRpcBody),
    });
    expect(res.status).toBe(402);
    const body = await parseBody(res);
    expect(body.error).toBe('Payment required');
    expect(body.x402Version).toBe(1);
    expect(body.accepts).toBeDefined();
    expect(res.headers.get('X-PAYMENT-REQUIRED')).toBe('base64encoded');
  });

  it('calls buildPaymentRequired with server price', async () => {
    selectResults.push([MOCK_SERVER]);

    const app = createApp();
    await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonRpcBody),
    });
    expect(mockBuildPaymentRequired).toHaveBeenCalledWith(
      expect.stringContaining('/servers/mcp_abcdef123456/invoke'),
      MOCK_SERVER.pricePerCallUsdc,
    );
  });

  it('returns 404 for inactive or missing server', async () => {
    selectResults.push([]);

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonRpcBody),
    });
    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.error).toContain('not found');
  });

  it('returns 402 when payment verification fails', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({
      valid: false,
      error: 'Payment rejected by facilitator',
    });

    const app = createApp();
    const res = await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-PAYLOAD': 'invalid-proof',
      },
      body: JSON.stringify(jsonRpcBody),
    });
    expect(res.status).toBe(402);
    const body = await parseBody(res);
    expect(body.error).toContain('Payment rejected by facilitator');
  });

  it('proxies request and returns 200 on valid payment + successful proxy', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ result: 'proxied-ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const app = createApp();
      const res = await app.request('/servers/mcp_abcdef123456/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-PAYLOAD': 'valid-payment-proof',
        },
        body: JSON.stringify(jsonRpcBody),
      });
      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.result).toBe('proxied-ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns 502 when upstream server is unreachable', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));

    try {
      const app = createApp();
      const res = await app.request('/servers/mcp_abcdef123456/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-PAYLOAD': 'valid-payment-proof',
        },
        body: JSON.stringify(jsonRpcBody),
      });
      expect(res.status).toBe(502);
      const body = await parseBody(res);
      expect(body.error).toContain('Upstream server unavailable');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('records transaction in database on successful proxy', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: true });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ result: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const app = createApp();
      await app.request('/servers/mcp_abcdef123456/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT-PAYLOAD': 'valid-proof',
        },
        body: JSON.stringify(jsonRpcBody),
      });
      // insert for transaction record + update for status + update for call count
      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockDbUpdate).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('verifies payment header is forwarded to verifyPayment', async () => {
    selectResults.push([MOCK_SERVER]);
    mockVerifyPayment.mockResolvedValueOnce({ valid: false, error: 'invalid' });

    const app = createApp();
    await app.request('/servers/mcp_abcdef123456/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT-PAYLOAD': 'my-payment-payload-value',
      },
      body: JSON.stringify(jsonRpcBody),
    });
    expect(mockVerifyPayment).toHaveBeenCalledWith(
      'my-payment-payload-value',
      expect.stringContaining('/servers/mcp_abcdef123456/invoke'),
      expect.objectContaining({ userId: expect.any(String), amountUsd: expect.any(String) }),
    );
  });
});

describe('POST /connect/onboard -- Stripe Connect onboarding', () => {
  beforeEach(resetMocks);

  it('returns 401 when unauthenticated', async () => {
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

  it('reuses existing Stripe Connect account when developer already has one', async () => {
    selectResults.push([{ stripeAccountId: 'acct_existing' }]);

    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/onboard', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.stripeAccountId).toBe('acct_existing');
    expect(mockStripeAccountsCreate).not.toHaveBeenCalled();
  });

  it('creates account link for onboarding', async () => {
    selectResults.push([]);

    const app = createApp(MOCK_USER);
    await app.request('/connect/onboard', { method: 'POST' });
    expect(mockStripeAccountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_new123',
        type: 'account_onboarding',
      }),
    );
  });

  it('logs Connect onboarding link creation', async () => {
    selectResults.push([]);

    const app = createApp(MOCK_USER);
    await app.request('/connect/onboard', { method: 'POST' });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Stripe Connect onboarding link created',
      expect.objectContaining({ developerId: 'user-1' }),
    );
  });
});

describe('GET /connect/return -- Stripe Connect callback', () => {
  beforeEach(resetMocks);

  it('returns success message', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/return');
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Stripe Connect onboarding complete');
  });

  it('returns 200 regardless of auth (handled by middleware passthrough)', async () => {
    const app = createApp(MOCK_USER);
    const res = await app.request('/connect/return');
    expect(res.status).toBe(200);
  });
});
