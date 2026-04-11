import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('../../collections/CollectionOperations.js', () => ({
  RevealUICollection: class MockCollection {
    slug: string;
    config: unknown;
    storage: unknown;
    constructor(config: { slug: string }, _db?: unknown, storage?: unknown) {
      this.slug = config.slug;
      this.config = config;
      this.storage = storage;
    }
    find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 });
  },
}));

vi.mock('../../globals/GlobalOperations.js', () => ({
  RevealUIGlobal: class MockGlobal {
    slug: string;
    constructor(config: { slug: string }) {
      this.slug = config.slug;
    }
    find = vi.fn().mockResolvedValue(null);
    update = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('../../dataloader.js', () => ({
  getDataLoader: vi.fn(() => ({ load: vi.fn() })),
}));

vi.mock('../../fields/hooks/afterRead/index.js', () => ({
  afterRead: vi.fn((args) => args.doc),
}));

vi.mock('../../utils/type-guards.js', () => ({
  isJsonFieldType: vi.fn(() => false),
  flattenFields: vi.fn((fields) => fields),
}));

vi.mock('../logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../methods/create.js', () => ({
  create: vi.fn().mockResolvedValue({ id: 'new-1' }),
}));

vi.mock('../methods/delete.js', () => ({
  deleteMethod: vi.fn().mockResolvedValue({ id: 'del-1' }),
}));

vi.mock('../methods/find.js', () => ({
  find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
}));

vi.mock('../methods/findById.js', () => ({
  findByID: vi.fn().mockResolvedValue({ id: '1' }),
}));

vi.mock('../methods/update.js', () => ({
  update: vi.fn().mockResolvedValue({ id: 'upd-1' }),
}));

import bcrypt from 'bcryptjs';
import { createRevealUIInstance } from '../RevealUIInstance.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function makeConfig(overrides: Record<string, any> = {}) {
  return {
    collections: [
      {
        slug: 'posts',
        fields: [{ name: 'title', type: 'text' }],
      },
      {
        slug: 'users',
        fields: [
          { name: 'email', type: 'text' },
          { name: 'password', type: 'text' },
        ],
      },
    ],
    globals: [
      {
        slug: 'settings',
        fields: [{ name: 'siteName', type: 'text' }],
      },
    ],
    db: {
      init: vi.fn(),
      connect: vi.fn(),
      createTable: vi.fn(),
      createGlobalTable: vi.fn(),
    },
    secret: 'test-secret',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests  -  createRevealUIInstance
// ---------------------------------------------------------------------------
describe('createRevealUIInstance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure build-time detection doesn't trigger
    delete process.env.NEXT_PHASE;
    process.env.RUNTIME_INIT = '1';
  });

  it('creates instance with collections and globals', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    expect(instance.collections).toBeDefined();
    expect(instance.collections.posts).toBeDefined();
    expect(instance.collections.users).toBeDefined();
    expect(instance.globals.settings).toBeDefined();
  });

  it('builds a collection storage registry and marks first-party typed candidates', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    expect(instance.collectionStorageRegistry.posts).toBeDefined();
    expect(instance.collectionStorageRegistry.users).toBeDefined();
    expect(instance.collectionStorageRegistry.posts.storageMode).toBe('typed-candidate');
    expect(instance.collections.posts.storage?.storageMode).toBe('typed-candidate');
    expect(instance.collectionStorageRegistry.posts.allowedColumns).toContain('title');
  });

  it('stores config and secret', async () => {
    const config = makeConfig();
    const instance = await createRevealUIInstance(config);

    expect(instance.config).toBe(config);
    expect(instance.secret).toBe('test-secret');
  });

  it('creates logger', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    expect(instance.logger).toBeDefined();
  });

  it('runs onInit hook', async () => {
    const onInit = vi.fn();
    await createRevealUIInstance(makeConfig({ onInit }));

    expect(onInit).toHaveBeenCalledOnce();
  });

  it('skips onInit during build time', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    const onInit = vi.fn();
    await createRevealUIInstance(makeConfig({ onInit }));

    expect(onInit).not.toHaveBeenCalled();
  });

  it('works without db config', async () => {
    const instance = await createRevealUIInstance(makeConfig({ db: undefined }));

    expect(instance.db).toBeNull();
  });

  it('works without collections/globals', async () => {
    const instance = await createRevealUIInstance(
      makeConfig({
        collections: undefined,
        globals: undefined,
      }),
    );

    expect(Object.keys(instance.collections)).toHaveLength(0);
    expect(Object.keys(instance.globals)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.find
// ---------------------------------------------------------------------------
describe('instance.find', () => {
  it('delegates to find method', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { find } = await import('../methods/find.js');

    await instance.find({ collection: 'posts' });

    expect(find).toHaveBeenCalledWith(instance, expect.any(Function), { collection: 'posts' });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.findByID
// ---------------------------------------------------------------------------
describe('instance.findByID', () => {
  it('delegates to findByID method', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { findByID } = await import('../methods/findById.js');

    await instance.findByID({ collection: 'posts', id: '1' });

    expect(findByID).toHaveBeenCalledWith(instance, expect.any(Function), {
      collection: 'posts',
      id: '1',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.create
// ---------------------------------------------------------------------------
describe('instance.create', () => {
  it('delegates to create method', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { create } = await import('../methods/create.js');

    await instance.create({ collection: 'posts', data: { title: 'Hello' } });

    expect(create).toHaveBeenCalledWith(instance, expect.any(Function), {
      collection: 'posts',
      data: { title: 'Hello' },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.update
// ---------------------------------------------------------------------------
describe('instance.update', () => {
  it('delegates to update method', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { update } = await import('../methods/update.js');

    await instance.update({ collection: 'posts', id: '1', data: { title: 'Updated' } });

    expect(update).toHaveBeenCalledWith(instance, expect.any(Function), {
      collection: 'posts',
      id: '1',
      data: { title: 'Updated' },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.delete
// ---------------------------------------------------------------------------
describe('instance.delete', () => {
  it('delegates to deleteMethod', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { deleteMethod } = await import('../methods/delete.js');

    await instance.delete({ collection: 'posts', id: '1' });

    expect(deleteMethod).toHaveBeenCalledWith(instance, expect.any(Function), {
      collection: 'posts',
      id: '1',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.login
// ---------------------------------------------------------------------------
describe('instance.login', () => {
  it('throws for unknown collection', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    await expect(
      instance.login({ collection: 'admins', data: { email: 'a@b.com', password: 'pass' } }),
    ).rejects.toThrow("Collection 'admins' not found");
  });

  it('throws for invalid email (user not found)', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    // Default mock returns { docs: [] }

    await expect(
      instance.login({ collection: 'users', data: { email: 'a@b.com', password: 'pass' } }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('throws when password is not a bcrypt hash', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    // Mock collection.find to return a user with plain-text password
    instance.collections.users.find = vi.fn().mockResolvedValue({
      docs: [{ id: 'u-1', email: 'a@b.com', password: 'plaintext' }],
    });

    await expect(
      instance.login({ collection: 'users', data: { email: 'a@b.com', password: 'plaintext' } }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('throws when password does not match', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.collections.users.find = vi.fn().mockResolvedValue({
      docs: [{ id: 'u-1', email: 'a@b.com', password: '$2b$10$hashedpassword' }],
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      instance.login({ collection: 'users', data: { email: 'a@b.com', password: 'wrong' } }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('returns user without password and opaque token on success', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.collections.users.find = vi.fn().mockResolvedValue({
      docs: [{ id: 'u-1', email: 'a@b.com', password: '$2b$10$hashedpassword', name: 'Alice' }],
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await instance.login({
      collection: 'users',
      data: { email: 'a@b.com', password: 'correct' },
    });

    expect(result.user.id).toBe('u-1');
    expect(result.user.name).toBe('Alice');
    expect(result.user.password).toBeUndefined();
    // Token is 32 random bytes → 64 hex chars
    expect(result.token).toHaveLength(64);
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws when user has no password field', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.collections.users.find = vi.fn().mockResolvedValue({
      docs: [{ id: 'u-1', email: 'a@b.com' }],
    });

    await expect(
      instance.login({ collection: 'users', data: { email: 'a@b.com', password: 'pass' } }),
    ).rejects.toThrow('Invalid credentials');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.findGlobal
// ---------------------------------------------------------------------------
describe('instance.findGlobal', () => {
  it('throws for unknown global', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    await expect(instance.findGlobal({ slug: 'nonexistent' })).rejects.toThrow(
      "Global 'nonexistent' not found",
    );
  });

  it('returns null when global doc not found', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    const result = await instance.findGlobal({ slug: 'settings' });

    expect(result).toBeNull();
  });

  it('returns doc without afterRead when depth is 0', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.globals.settings.find = vi.fn().mockResolvedValue({ siteName: 'Test' });

    const result = await instance.findGlobal({ slug: 'settings' });

    expect(result).toEqual({ siteName: 'Test' });
    const { afterRead } = await import('../../fields/hooks/afterRead/index.js');
    expect(afterRead).not.toHaveBeenCalled();
  });

  it('applies afterRead when depth > 0 and req provided', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.globals.settings.find = vi.fn().mockResolvedValue({ siteName: 'Test' });

    const result = await instance.findGlobal({
      slug: 'settings',
      depth: 2,
      req: { context: {} } as never,
    });

    const { afterRead } = await import('../../fields/hooks/afterRead/index.js');
    expect(afterRead).toHaveBeenCalledWith(
      expect.objectContaining({
        depth: 2,
        doc: { siteName: 'Test' },
      }),
    );
    expect(result).toEqual({ siteName: 'Test' });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.updateGlobal
// ---------------------------------------------------------------------------
describe('instance.updateGlobal', () => {
  it('throws for unknown global', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    await expect(instance.updateGlobal({ slug: 'nonexistent', data: {} })).rejects.toThrow(
      "Global 'nonexistent' not found",
    );
  });

  it('delegates to global.update', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    instance.globals.settings.update = vi.fn().mockResolvedValue({ siteName: 'Updated' });

    const result = await instance.updateGlobal({
      slug: 'settings',
      data: { siteName: 'Updated' },
    });

    expect(result).toEqual({ siteName: 'Updated' });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  instance.populate
// ---------------------------------------------------------------------------
describe('instance.populate', () => {
  it('throws for unknown collection', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    await expect(instance.populate('nonexistent', { id: '1' })).rejects.toThrow(
      "Collection 'nonexistent' not found",
    );
  });

  it('populates a single document', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const doc = { id: '1', title: 'Hello' };

    const result = await instance.populate('posts', doc, { depth: 2 });

    const { afterRead } = await import('../../fields/hooks/afterRead/index.js');
    expect(afterRead).toHaveBeenCalledWith(
      expect.objectContaining({
        depth: 2,
        doc,
      }),
    );
    expect(result).toEqual(doc);
  });

  it('populates an array of documents', async () => {
    const instance = await createRevealUIInstance(makeConfig());
    const { afterRead } = await import('../../fields/hooks/afterRead/index.js');
    vi.mocked(afterRead).mockClear();

    const docs = [{ id: '1' }, { id: '2' }];
    const result = await instance.populate('posts', docs);

    expect(afterRead).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('uses default options when none provided', async () => {
    const instance = await createRevealUIInstance(makeConfig());

    await instance.populate('posts', { id: '1' });

    const { afterRead } = await import('../../fields/hooks/afterRead/index.js');
    expect(afterRead).toHaveBeenCalledWith(
      expect.objectContaining({
        depth: 1,
        draft: false,
        locale: 'en',
        fallbackLocale: 'en',
        overrideAccess: false,
        showHiddenFields: false,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests  -  DB table setup during instance creation
// ---------------------------------------------------------------------------
describe('DB table setup', () => {
  it('does not call db methods when no db is configured', async () => {
    const instance = await createRevealUIInstance(makeConfig({ db: undefined }));

    expect(instance.db).toBeNull();
  });
});
