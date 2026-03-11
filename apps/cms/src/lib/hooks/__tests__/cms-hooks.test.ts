import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// createTenant
// ---------------------------------------------------------------------------

describe('createTenant', () => {
  const mockFind = vi.fn();
  const mockCreate = vi.fn();
  const mockLogger = { error: vi.fn() };

  const makeReq = () => ({
    revealui: {
      find: mockFind,
      create: mockCreate,
      logger: mockLogger,
    },
  });

  const baseDoc = { id: 'user-1', email: 'user@test.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadCreateTenant() {
    const mod = await import('../createTenant.js');
    return mod.createTenant;
  }

  it('returns doc unchanged when operation is not create', async () => {
    const createTenant = await loadCreateTenant();
    const result = await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'update',
      context: { email: 'user@test.com' },
    } as never);
    expect(result).toEqual(baseDoc);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns doc unchanged when TenantID already exists', async () => {
    const createTenant = await loadCreateTenant();
    const docWithTenant = { ...baseDoc, TenantID: 'existing-tenant' };
    const result = await createTenant({
      req: makeReq(),
      doc: docWithTenant,
      operation: 'create',
      context: { email: 'user@test.com' },
    } as never);
    expect(result).toEqual(docWithTenant);
  });

  it('returns doc unchanged when req.revealui is missing', async () => {
    const createTenant = await loadCreateTenant();
    const result = await createTenant({
      req: {},
      doc: baseDoc,
      operation: 'create',
      context: { email: 'user@test.com' },
    } as never);
    expect(result).toEqual(baseDoc);
  });

  it('returns doc unchanged when context.email is missing', async () => {
    const createTenant = await loadCreateTenant();
    const result = await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'create',
      context: {},
    } as never);
    expect(result).toEqual(baseDoc);
  });

  it('assigns existing tenant ID when tenant found by email', async () => {
    const createTenant = await loadCreateTenant();
    mockFind.mockResolvedValue({
      totalDocs: 1,
      docs: [{ id: 'tenant-42' }],
    });
    const result = await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'create',
      context: { email: 'user@test.com' },
    } as never);
    expect(result).toEqual({ ...baseDoc, TenantID: 'tenant-42' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates new tenant when none found by email', async () => {
    const createTenant = await loadCreateTenant();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    mockCreate.mockResolvedValue({ id: 'new-tenant-99' });
    const result = await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'create',
      context: { email: 'user@test.com', password: 'secret' },
    } as never);
    expect(result).toEqual({ ...baseDoc, TenantID: 'new-tenant-99' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        data: expect.objectContaining({
          email: 'user@test.com',
          password: 'secret',
        }),
      }),
    );
  });

  it('creates tenant without password when password is undefined', async () => {
    const createTenant = await loadCreateTenant();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    mockCreate.mockResolvedValue({ id: 'new-tenant-100' });
    await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'create',
      context: { email: 'user@test.com' },
    } as never);
    const createArg = mockCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createArg.data).not.toHaveProperty('password');
  });

  it('logs error and returns doc on failure', async () => {
    const createTenant = await loadCreateTenant();
    mockFind.mockRejectedValue(new Error('db down'));
    const result = await createTenant({
      req: makeReq(),
      doc: baseDoc,
      operation: 'create',
      context: { email: 'user@test.com' },
    } as never);
    expect(result).toEqual(baseDoc);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});

// ---------------------------------------------------------------------------
// loginAfterCreate
// ---------------------------------------------------------------------------

describe('loginAfterCreate', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadLoginAfterCreate() {
    const mod = await import('../loginAfterCreate.js');
    return mod.loginAfterCreate;
  }

  it('returns doc unchanged when operation is not create', async () => {
    const loginAfterCreate = await loadLoginAfterCreate();
    const doc = { id: '1', email: 'a@b.com' };
    const result = await loginAfterCreate({
      doc,
      req: { revealui: { login: mockLogin } },
      operation: 'update',
    });
    expect(result).toEqual(doc);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('returns doc unchanged when user is already logged in', async () => {
    const loginAfterCreate = await loadLoginAfterCreate();
    const doc = { id: '1', email: 'a@b.com' };
    const result = await loginAfterCreate({
      doc,
      req: { user: { id: 'existing' }, revealui: { login: mockLogin } },
      operation: 'create',
    });
    expect(result).toEqual(doc);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('returns doc unchanged when revealui is missing', async () => {
    const loginAfterCreate = await loadLoginAfterCreate();
    const doc = { id: '1', email: 'a@b.com' };
    const result = await loginAfterCreate({
      doc,
      req: {},
      operation: 'create',
    });
    expect(result).toEqual(doc);
  });

  it('returns doc unchanged when email or password is missing', async () => {
    const loginAfterCreate = await loadLoginAfterCreate();
    const doc = { id: '1' }; // no email
    const result = await loginAfterCreate({
      doc,
      req: { revealui: { login: mockLogin }, data: { password: 'pass' } },
      operation: 'create',
    });
    expect(result).toEqual(doc);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('logs in and returns doc with token and user on create', async () => {
    const loginAfterCreate = await loadLoginAfterCreate();
    mockLogin.mockResolvedValue({ user: { id: '1', email: 'a@b.com' }, token: 'session-abc' });
    const doc = { id: '1', email: 'a@b.com' };
    const result = await loginAfterCreate({
      doc,
      req: { revealui: { login: mockLogin }, data: { password: 'secret123' } },
      operation: 'create',
    });
    expect(result).toEqual({
      ...doc,
      token: 'session-abc',
      user: { id: '1', email: 'a@b.com' },
    });
    expect(mockLogin).toHaveBeenCalledWith({
      collection: 'users',
      data: { email: 'a@b.com', password: 'secret123' },
    });
  });
});

// ---------------------------------------------------------------------------
// ensureFirstUserIsSuperAdmin
// ---------------------------------------------------------------------------

describe('ensureFirstUserIsSuperAdmin', () => {
  const mockFind = vi.fn();

  const makeReq = () => ({ revealui: { find: mockFind } }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../ensureFirstUserIsSuperAdmin.js');
    return mod.ensureFirstUserIsSuperAdmin;
  }

  it('returns value unchanged when operation is not create', async () => {
    const hook = await loadHook();
    const result = await hook({ req: makeReq(), operation: 'update', value: ['user'] });
    expect(result).toEqual(['user']);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns value unchanged when req.revealui is missing', async () => {
    const hook = await loadHook();
    const result = await hook({ req: {}, operation: 'create', value: ['user'] });
    expect(result).toEqual(['user']);
  });

  it('adds super-admin role when no users exist', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    const result = await hook({ req: makeReq(), operation: 'create', value: ['user'] });
    expect(result).toContain('tenant-super-admin');
    expect(result).toContain('user');
  });

  it('does not duplicate super-admin if already in roles', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: ['tenant-super-admin', 'user'],
    });
    expect(result).toEqual(['tenant-super-admin', 'user']);
  });

  it('returns value unchanged when users already exist', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 5, docs: [{ id: '1' }] });
    const result = await hook({ req: makeReq(), operation: 'create', value: ['user'] });
    expect(result).toEqual(['user']);
  });

  it('handles undefined value by starting with empty array', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });
    const result = await hook({ req: makeReq(), operation: 'create', value: undefined });
    expect(result).toEqual(['tenant-super-admin']);
  });
});

// ---------------------------------------------------------------------------
// resolveDuplicatePurchases
// ---------------------------------------------------------------------------

describe('resolveDuplicatePurchases', () => {
  async function loadHook() {
    const mod = await import('../resolveDuplicatePurchases.js');
    return mod.resolveDuplicatePurchases;
  }

  it('returns value unchanged when operation is not create or update', async () => {
    const hook = await loadHook();
    const result = await hook({ value: ['a', 'a', 'b'], operation: 'read' });
    expect(result).toEqual(['a', 'a', 'b']);
  });

  it('returns undefined when value is undefined', async () => {
    const hook = await loadHook();
    const result = await hook({ value: undefined, operation: 'create' });
    expect(result).toBeUndefined();
  });

  it('deduplicates string purchase IDs on create', async () => {
    const hook = await loadHook();
    const result = await hook({ value: ['a', 'b', 'a', 'c', 'b'], operation: 'create' });
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates object purchase IDs on update', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: [{ id: 'x' }, { id: 'y' }, { id: 'x' }],
      operation: 'update',
    });
    expect(result).toEqual(['x', 'y']);
  });

  it('handles mixed string and object purchase IDs', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['a', { id: 'a' }, { id: 'b' }, 'b'],
      operation: 'create',
    });
    expect(result).toEqual(['a', 'b']);
  });

  it('preserves order (first occurrence wins)', async () => {
    const hook = await loadHook();
    const result = await hook({
      value: ['c', 'a', 'b', 'a', 'c'],
      operation: 'update',
    });
    expect(result).toEqual(['c', 'a', 'b']);
  });

  it('handles empty array', async () => {
    const hook = await loadHook();
    const result = await hook({ value: [], operation: 'create' });
    expect(result).toEqual([]);
  });

  it('handles single item', async () => {
    const hook = await loadHook();
    const result = await hook({ value: ['only-one'], operation: 'update' });
    expect(result).toEqual(['only-one']);
  });
});
