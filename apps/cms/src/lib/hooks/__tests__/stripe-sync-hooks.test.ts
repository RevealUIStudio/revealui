import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/lib/access/permissions/roles';

// ---------------------------------------------------------------------------
// Mock @revealui/services — dynamic import used by proxy handlers
// ---------------------------------------------------------------------------

const mockCustomersList = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCustomersDel = vi.fn();
const mockProductsList = vi.fn();

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    customers: {
      list: mockCustomersList,
      retrieve: mockCustomersRetrieve,
      update: mockCustomersUpdate,
      create: mockCustomersCreate,
      del: mockCustomersDel,
    },
    products: {
      list: mockProductsList,
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRequestOptions {
  user?: Record<string, unknown> | null;
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  revealui?: { logger?: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } };
}

function createMockRequest(opts: MockRequestOptions = {}) {
  return {
    user: opts.user ?? null,
    method: opts.method ?? 'GET',
    body: opts.body,
    query: opts.query ?? {},
    revealui: opts.revealui ?? {
      logger: { info: vi.fn(), error: vi.fn() },
    },
  };
}

function superAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    globalRoles: [Role.UserSuperAdmin],
    ...overrides,
  };
}

function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-2',
    email: 'admin2@test.com',
    globalRoles: [Role.UserAdmin],
    ...overrides,
  };
}

function regularUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-3',
    email: 'user@test.com',
    globalRoles: [Role.User],
    ...overrides,
  };
}

async function parseResponseJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text());
}

// =============================================================================
// customersProxy (list all customers)
// =============================================================================

describe('customersProxy', () => {
  let customersProxy: (req: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../customersProxy.js');
    customersProxy = mod.customersProxy as unknown as typeof customersProxy;
  });

  it('returns 401 when user is not authenticated', async () => {
    const req = createMockRequest({ user: null });
    const res = await customersProxy(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when user lacks UserSuperAdmin role', async () => {
    const req = createMockRequest({ user: regularUser() });
    const res = await customersProxy(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 for UserAdmin (requires UserSuperAdmin)', async () => {
    const req = createMockRequest({ user: adminUser() });
    const res = await customersProxy(req);

    expect(res.status).toBe(401);
  });

  it('lists customers when user is UserSuperAdmin', async () => {
    const mockCustomers = {
      data: [
        { id: 'cus_1', email: 'a@test.com' },
        { id: 'cus_2', email: 'b@test.com' },
      ],
      has_more: false,
    };
    mockCustomersList.mockResolvedValue(mockCustomers);

    const req = createMockRequest({ user: superAdminUser() });
    const res = await customersProxy(req);

    expect(res.status).toBe(200);
    const body = await parseResponseJson(res);
    expect(body).toEqual(mockCustomers);
    expect(mockCustomersList).toHaveBeenCalledWith({ limit: 100 });
  });

  it('returns error response when Stripe API throws', async () => {
    mockCustomersList.mockRejectedValue(new Error('Stripe rate limit'));

    const req = createMockRequest({ user: superAdminUser() });
    const res = await customersProxy(req);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // Note: The @revealui/services unavailable path (503) cannot be tested here because
  // vi.doMock does not properly intercept dynamic import() within Vitest's fork pool.
  // The handler code uses `await import('@revealui/services').catch(() => null)` which
  // is structurally verified via code review.
});

// =============================================================================
// customerProxy (single customer CRUD)
// =============================================================================

describe('customerProxy', () => {
  let customerProxy: (req: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../customersProxy.js');
    customerProxy = mod.customerProxy as unknown as typeof customerProxy;
  });

  // -------------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------------

  it('returns 401 when user is not authenticated', async () => {
    const req = createMockRequest({ user: null });
    const res = await customerProxy(req);

    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no id', async () => {
    const req = createMockRequest({
      user: { email: 'no-id@test.com', globalRoles: [Role.UserSuperAdmin] },
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(404);
  });

  it('returns 400 when user has no stripeCustomerID', async () => {
    const req = createMockRequest({
      user: superAdminUser(),
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(400);
    const body = await parseResponseJson(res);
    expect(body).toHaveProperty('error', 'STRIPE_CUSTOMER_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // GET — retrieve customer
  // -------------------------------------------------------------------------

  it('GET retrieves the Stripe customer', async () => {
    const stripeCustomer = {
      id: 'cus_stripe_1',
      email: 'admin@test.com',
      deleted: false,
    };
    mockCustomersRetrieve.mockResolvedValue(stripeCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'GET',
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(200);
    const body = await parseResponseJson(res);
    expect(body).toEqual(stripeCustomer);
    expect(mockCustomersRetrieve).toHaveBeenCalledWith('cus_stripe_1', {
      expand: ['invoice_settings.default_payment_method'],
    });
  });

  it('returns 404 when Stripe customer is deleted', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_deleted',
      deleted: true,
    });

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_deleted' }),
      method: 'GET',
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(404);
  });

  it('returns 401 when retrieved customer id does not match', async () => {
    mockCustomersRetrieve.mockResolvedValue({
      id: 'cus_different',
      deleted: false,
    });

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'GET',
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // PATCH — update customer
  // -------------------------------------------------------------------------

  it('PATCH updates the customer with validated data', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    const updatedCustomer = { id: 'cus_stripe_1', name: 'Updated Name' };

    mockCustomersRetrieve.mockResolvedValue(existingCustomer);
    mockCustomersUpdate.mockResolvedValue(updatedCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'PATCH',
      body: { name: 'Updated Name', email: 'new@test.com' },
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(200);
    expect(mockCustomersUpdate).toHaveBeenCalledWith('cus_stripe_1', {
      name: 'Updated Name',
      email: 'new@test.com',
    });
  });

  it('PATCH returns validation error for invalid email', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    mockCustomersRetrieve.mockResolvedValue(existingCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'PATCH',
      body: { email: 'not-an-email' },
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(400);
  });

  it('PATCH returns validation error when no body provided', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    mockCustomersRetrieve.mockResolvedValue(existingCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'PATCH',
      body: undefined,
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // POST — create customer
  // -------------------------------------------------------------------------

  it('POST creates a customer with validated data', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    const newCustomer = { id: 'cus_new_1', email: 'new@test.com' };

    mockCustomersRetrieve.mockResolvedValue(existingCustomer);
    mockCustomersCreate.mockResolvedValue(newCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'POST',
      body: { email: 'new@test.com', name: 'New Customer' },
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(200);
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'new@test.com',
      name: 'New Customer',
    });
  });

  it('POST returns validation error when email is missing', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    mockCustomersRetrieve.mockResolvedValue(existingCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'POST',
      body: { name: 'No Email' },
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(400);
  });

  it('POST returns validation error when no body provided', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    mockCustomersRetrieve.mockResolvedValue(existingCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'POST',
      body: undefined,
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // DELETE — remove customer
  // -------------------------------------------------------------------------

  it('DELETE removes the customer', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    const deletedCustomer = { id: 'cus_stripe_1', deleted: true };

    mockCustomersRetrieve.mockResolvedValue(existingCustomer);
    mockCustomersDel.mockResolvedValue(deletedCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'DELETE',
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(200);
    expect(mockCustomersDel).toHaveBeenCalledWith('cus_stripe_1');
  });

  // -------------------------------------------------------------------------
  // Method Not Allowed
  // -------------------------------------------------------------------------

  it('returns 405 for unsupported HTTP methods', async () => {
    const existingCustomer = { id: 'cus_stripe_1', deleted: false };
    mockCustomersRetrieve.mockResolvedValue(existingCustomer);

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'PUT',
    });
    const res = await customerProxy(req);

    expect(res.status).toBe(405);
  });

  // -------------------------------------------------------------------------
  // Stripe API errors
  // -------------------------------------------------------------------------

  it('returns error response when Stripe retrieve throws', async () => {
    mockCustomersRetrieve.mockRejectedValue(new Error('Stripe network error'));

    const req = createMockRequest({
      user: superAdminUser({ stripeCustomerID: 'cus_stripe_1' }),
      method: 'GET',
    });
    const res = await customerProxy(req);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // Note: The @revealui/services unavailable path (503) cannot be tested here because
  // vi.doMock does not properly intercept dynamic import() within Vitest's fork pool.
});

// =============================================================================
// productsProxy (list all products)
// =============================================================================

describe('productsProxy', () => {
  let productsProxy: (req: unknown) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../productsProxy.js');
    productsProxy = mod.productsProxy as unknown as typeof productsProxy;
  });

  it('returns 401 when user is not authenticated', async () => {
    const req = createMockRequest({ user: null });
    const res = await productsProxy(req);

    expect(res.status).toBe(401);
    expect(await res.text()).toContain('not authorized');
  });

  it('returns 401 when user lacks admin role', async () => {
    const req = createMockRequest({ user: regularUser() });
    const res = await productsProxy(req);

    expect(res.status).toBe(401);
  });

  it('allows UserSuperAdmin to list products', async () => {
    const mockProducts = {
      data: [
        { id: 'prod_1', name: 'Product A', active: true },
        { id: 'prod_2', name: 'Product B', active: false },
      ],
      has_more: false,
    };
    mockProductsList.mockResolvedValue(mockProducts);

    const req = createMockRequest({ user: superAdminUser() });
    const res = await productsProxy(req);

    expect(res.status).toBe(200);
    const body = await parseResponseJson(res);
    expect(body).toEqual(mockProducts);
    expect(mockProductsList).toHaveBeenCalledWith({ limit: 100 });
  });

  it('allows UserAdmin to list products', async () => {
    const mockProducts = { data: [], has_more: false };
    mockProductsList.mockResolvedValue(mockProducts);

    const req = createMockRequest({ user: adminUser() });
    const res = await productsProxy(req);

    expect(res.status).toBe(200);
  });

  it('returns 500 when Stripe API throws', async () => {
    mockProductsList.mockRejectedValue(new Error('Stripe connection failed'));

    const req = createMockRequest({ user: superAdminUser() });
    const res = await productsProxy(req);

    expect(res.status).toBe(500);
    expect(await res.text()).toContain('Stripe connection failed');
  });

  // Note: The @revealui/services unavailable path (503) cannot be tested here because
  // vi.doMock does not properly intercept dynamic import() within Vitest's fork pool.

  it('does not expose raw Stripe error objects in response', async () => {
    const stripeError = new Error('Card declined');
    (stripeError as unknown as Record<string, unknown>).type = 'StripeCardError';
    (stripeError as unknown as Record<string, unknown>).raw = { sensitive: 'data' };
    mockProductsList.mockRejectedValue(stripeError);

    const req = createMockRequest({ user: superAdminUser() });
    const res = await productsProxy(req);

    const text = await res.text();
    // Should contain the error message but not raw Stripe internals
    expect(text).toContain('Card declined');
    expect(text).not.toContain('sensitive');
  });
});

// =============================================================================
// resolveDuplicatePurchases
// =============================================================================

describe('resolveDuplicatePurchases', () => {
  async function loadHook() {
    const mod = await import('../resolveDuplicatePurchases.js');
    return mod.resolveDuplicatePurchases;
  }

  it('deduplicates on create operation', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['prod-1', 'prod-2', 'prod-1', 'prod-3', 'prod-2'],
      operation: 'create',
    });
    expect(result).toEqual(['prod-1', 'prod-2', 'prod-3']);
  });

  it('deduplicates on update operation', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['prod-a', 'prod-a', 'prod-b'],
      operation: 'update',
    });
    expect(result).toEqual(['prod-a', 'prod-b']);
  });

  it('returns value unchanged on read operation', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['prod-1', 'prod-1'],
      operation: 'read',
    });
    expect(result).toEqual(['prod-1', 'prod-1']);
  });

  it('returns value unchanged on delete operation', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['prod-1', 'prod-1'],
      operation: 'delete',
    });
    expect(result).toEqual(['prod-1', 'prod-1']);
  });

  it('returns undefined when value is undefined', async () => {
    const hook = await loadHook();
    const result = await hook({ value: undefined, operation: 'create' });
    expect(result).toBeUndefined();
  });

  it('handles empty array', async () => {
    const hook = await loadHook();
    const result = await hook({ value: [], operation: 'create' });
    expect(result).toEqual([]);
  });

  it('deduplicates object purchases by extracting id', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: [{ id: 'p1' }, { id: 'p2' }, { id: 'p1' }],
      operation: 'update',
    });
    expect(result).toEqual(['p1', 'p2']);
  });

  it('deduplicates mixed string and object purchases', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['p1', { id: 'p1' }, 'p2', { id: 'p3' }, { id: 'p2' }],
      operation: 'create',
    });
    expect(result).toEqual(['p1', 'p2', 'p3']);
  });

  it('preserves order (first occurrence wins)', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['z', 'a', 'm', 'a', 'z'],
      operation: 'create',
    });
    expect(result).toEqual(['z', 'a', 'm']);
  });

  it('handles single-item array without modification', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['only-one'],
      operation: 'update',
    });
    expect(result).toEqual(['only-one']);
  });

  it('returns undefined when value is undefined and operation is not create/update', async () => {
    const hook = await loadHook();
    const result = await hook({ value: undefined, operation: 'read' });
    expect(result).toBeUndefined();
  });
});
