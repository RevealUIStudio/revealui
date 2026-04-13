import type { RevealFindOptions } from '@revealui/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTypedCollectionStorage } from '../typedCollectionStorage';

const { getRestClient } = vi.hoisted(() => ({
  getRestClient: vi.fn(),
}));

vi.mock('@revealui/db/client', () => ({
  getRestClient,
}));

describe('typedCollectionStorage', () => {
  const originalPostgresUrl = process.env.POSTGRES_URL;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();

    if (originalPostgresUrl === undefined) {
      delete process.env.POSTGRES_URL;
    } else {
      process.env.POSTGRES_URL = originalPostgresUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('returns undefined when no Postgres connection is configured', () => {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;

    expect(createTypedCollectionStorage()).toBeUndefined();
  });

  it('maps users through Drizzle for findByID', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    getRestClient.mockReturnValue({
      query: {
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'user_1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            password: 'hashed',
            role: 'admin',
            status: 'active',
            type: 'human',
            stripeCustomerId: 'cus_123',
            avatarUrl: null,
            emailVerified: true,
            emailVerifiedAt: null,
            tosAcceptedAt: null,
            tosVersion: null,
            lastActiveAt: null,
            createdAt: new Date('2026-03-12T00:00:00Z'),
            updatedAt: new Date('2026-03-12T00:00:00Z'),
            _json: {
              roles: ['admin'],
            },
          }),
        },
      },
    });

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(
      {
        slug: 'users',
        fields: [],
      },
      { id: 'user_1' },
    );

    expect(doc).toMatchObject({
      id: 'user_1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: ['admin'],
    });
  });

  it('opts out for unsupported collections', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'posts',
        fields: [],
      },
      {},
    );

    expect(result).toBeUndefined();
    expect(getRestClient).not.toHaveBeenCalled();
  });

  it('maps users through Drizzle for paginated find', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'user_1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'hashed',
        role: 'admin',
        status: 'active',
        type: 'human',
        stripeCustomerId: 'cus_123',
        avatarUrl: null,
        emailVerified: true,
        emailVerifiedAt: null,
        tosAcceptedAt: null,
        tosVersion: null,
        lastActiveAt: null,
        createdAt: new Date('2026-03-12T00:00:00Z'),
        updatedAt: new Date('2026-03-12T00:00:00Z'),
        _json: {
          roles: ['admin'],
        },
      },
    ]);
    const where = vi.fn().mockResolvedValue([{ value: 1 }]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    getRestClient.mockReturnValue({
      query: {
        users: {
          findMany,
        },
      },
      select,
    });

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'users',
        fields: [],
      },
      {
        page: 1,
        limit: 10,
        where: {
          status: { equals: 'active' },
        },
        sort: {
          createdAt: '-1',
        } as unknown as RevealFindOptions['sort'],
      },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 0,
      }),
    );
    expect(result).toMatchObject({
      totalDocs: 1,
      totalPages: 1,
      page: 1,
      docs: [
        expect.objectContaining({
          id: 'user_1',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      ],
    });
  });

  it('maps tenants through Drizzle for findByID', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    getRestClient.mockReturnValue({
      query: {
        tenants: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tenant_1',
            name: 'Example Tenant',
            email: 'tenant@example.com',
            password: 'hashed',
            roles: ['tenant-admin'],
            domains: [{ domain: 'tenant.example.com' }],
            _json: {},
            createdAt: new Date('2026-03-12T00:00:00Z'),
            updatedAt: new Date('2026-03-12T00:00:00Z'),
          }),
        },
      },
    });

    const storage = createTypedCollectionStorage();
    const doc = await storage?.findByID?.(
      {
        slug: 'tenants',
        fields: [],
      },
      { id: 'tenant_1' },
    );

    expect(doc).toMatchObject({
      id: 'tenant_1',
      email: 'tenant@example.com',
      roles: ['tenant-admin'],
      domains: [{ domain: 'tenant.example.com' }],
    });
  });

  it('maps tenants through Drizzle for domain-based find', async () => {
    process.env.POSTGRES_URL = 'postgresql://example';

    const tenantsFindMany = vi.fn().mockResolvedValue([
      {
        id: 'tenant_1',
        name: 'Example Tenant',
        email: 'tenant@example.com',
        password: 'hashed',
        roles: ['tenant-admin'],
        domains: [{ domain: 'tenant.example.com' }],
        _json: {},
        createdAt: new Date('2026-03-12T00:00:00Z'),
        updatedAt: new Date('2026-03-12T00:00:00Z'),
      },
    ]);
    const where = vi.fn().mockResolvedValue([{ value: 1 }]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    getRestClient.mockReturnValue({
      query: {
        tenants: {
          findMany: tenantsFindMany,
        },
      },
      select,
    });

    const storage = createTypedCollectionStorage();
    const result = await storage?.find?.(
      {
        slug: 'tenants',
        fields: [],
      },
      {
        where: {
          'domains.domain': {
            equals: 'tenant.example.com',
          },
        },
        limit: 1,
        page: 1,
      },
    );

    expect(tenantsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 1,
        offset: 0,
      }),
    );
    expect(result).toMatchObject({
      totalDocs: 1,
      docs: [
        expect.objectContaining({
          id: 'tenant_1',
          email: 'tenant@example.com',
        }),
      ],
    });
  });
});
