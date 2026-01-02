import { describe, it, expect, beforeEach } from 'vitest';
import { createRevealUIPayload } from '@revealui/cms/cms/core/payload';
import type { RevealCollectionConfig } from '@revealui/cms/cms/types';

// Mock collections that match real CMS structure (without complex imports)
const mockPostsCollection: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text' },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true
    }
  ]
};

const mockUsersCollection: RevealCollectionConfig = {
  slug: 'users',
  fields: [
    { name: 'email', type: 'text' },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    {
      name: 'tenants',
      type: 'array',
      fields: [
        {
          name: 'tenant',
          type: 'relationship',
          relationTo: 'tenants'
        },
        { name: 'roles', type: 'select', hasMany: true }
      ]
    },
    {
      name: 'lastLoggedInTenant',
      type: 'relationship',
      relationTo: 'tenants'
    }
  ]
};

const mockOrdersCollection: RevealCollectionConfig = {
  slug: 'orders',
  fields: [
    {
      name: 'orderedBy',
      type: 'relationship',
      relationTo: 'users'
    },
    { name: 'total', type: 'number' },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products'
        },
        { name: 'price', type: 'number' },
        { name: 'quantity', type: 'number' }
      ]
    }
  ]
};

const mockProductsCollection: RevealCollectionConfig = {
  slug: 'products',
  fields: [
    { name: 'name', type: 'text' },
    { name: 'price', type: 'number' },
    { name: 'description', type: 'text' }
  ]
};

const mockTenantsCollection: RevealCollectionConfig = {
  slug: 'tenants',
  fields: [
    { name: 'name', type: 'text' },
    { name: 'slug', type: 'text' }
  ]
};

// Mock database that simulates real data structure
const mockDb = {
  query: async (query: string, values: unknown[] = []) => {
    // Mock posts with authors relationship (hasMany)
    if (query.includes('SELECT') && query.includes('posts')) {
      return {
        rows: [{
          id: 'post-1',
          title: 'Test Post',
          slug: 'test-post',
          authors: ['user-1', 'user-2'], // hasMany stored as array
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        rowCount: 1
      };
    }

    // Mock users with tenant relationships
    if (query.includes('SELECT') && query.includes('users')) {
      if (values.includes('user-1')) {
        return {
          rows: [{
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            tenants: [{ tenant: 'tenant-1', roles: ['tenant-admin'] }],
            lastLoggedInTenant_id: 'tenant-1' // FK relationship
          }],
          rowCount: 1
        };
      }
      if (values.includes('user-2')) {
        return {
          rows: [{
            id: 'user-2',
            email: 'author@example.com',
            firstName: 'Content',
            lastName: 'Author',
            tenants: [{ tenant: 'tenant-1', roles: ['tenant-admin'] }],
            lastLoggedInTenant_id: 'tenant-1'
          }],
          rowCount: 1
        };
      }
    }

    // Mock orders with user and product relationships
    if (query.includes('SELECT') && query.includes('orders')) {
      return {
        rows: [{
          id: 'order-1',
          orderedBy_id: 'user-1', // FK relationship
          total: 99.99,
          items: [{
            product_id: 'product-1', // Nested FK
            price: 49.99,
            quantity: 2
          }],
          createdAt: new Date()
        }],
        rowCount: 1
      };
    }

    // Mock products
    if (query.includes('SELECT') && query.includes('products')) {
      return {
        rows: [{
          id: 'product-1',
          name: 'Test Product',
          price: 49.99,
          description: 'A test product'
        }],
        rowCount: 1
      };
    }

    // Mock tenants
    if (query.includes('SELECT') && query.includes('tenants')) {
      return {
        rows: [{
          id: 'tenant-1',
          name: 'Test Tenant',
          slug: 'test-tenant'
        }],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 0 };
  },
  init: async () => {},
  connect: async () => {},
};

describe('Relationship System Integration with Real CMS Collections', () => {
  let payload: any;

  beforeEach(async () => {
    const config = {
      collections: [mockPostsCollection, mockUsersCollection, mockOrdersCollection, mockProductsCollection, mockTenantsCollection],
      db: mockDb
    };
    payload = await createRevealUIPayload(config);
  });

  it('should populate hasMany authors relationship in posts', async () => {
    const mockDataLoader = {
      load: async (cacheKey: string) => {
        const parsed = JSON.parse(cacheKey);
        if (parsed[2] === 'user-1') {
          return {
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User'
          };
        }
        if (parsed[2] === 'user-2') {
          return {
            id: 'user-2',
            email: 'author@example.com',
            firstName: 'Content',
            lastName: 'Author'
          };
        }
        return null;
      }
    };

    const mockReq = {
      payload,
      transactionID: 'test-tx',
      context: {},
      locale: 'en',
      fallbackLocale: 'en',
      payloadDataLoader: mockDataLoader
    };

    const result = await payload.find({
      collection: 'posts',
      depth: 1,
      req: mockReq
    });

    expect(result.docs[0]).toBeDefined();
    expect(result.docs[0].title).toBe('Test Post');

    // Test hasMany relationship population
    expect(result.docs[0].authors).toBeDefined();
    expect(Array.isArray(result.docs[0].authors)).toBe(true);
    expect(result.docs[0].authors).toHaveLength(2);
    expect(result.docs[0].authors[0].firstName).toBe('Admin');
    expect(result.docs[0].authors[1].firstName).toBe('Content');
  });

  it('should populate nested relationships in orders (depth: 2)', async () => {
    const mockDataLoader = {
      load: async (cacheKey: string) => {
        const parsed = JSON.parse(cacheKey);
        if (parsed[2] === 'user-1') {
          return {
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            lastLoggedInTenant_id: 'tenant-1'
          };
        }
        if (parsed[2] === 'product-1') {
          return {
            id: 'product-1',
            name: 'Test Product',
            price: 49.99
          };
        }
        if (parsed[2] === 'tenant-1') {
          return {
            id: 'tenant-1',
            name: 'Test Tenant',
            slug: 'test-tenant'
          };
        }
        return null;
      }
    };

    const mockReq = {
      payload,
      transactionID: 'test-tx',
      context: {},
      locale: 'en',
      fallbackLocale: 'en',
      payloadDataLoader: mockDataLoader
    };

    const result = await payload.find({
      collection: 'orders',
      depth: 2,
      req: mockReq
    });

    expect(result.docs[0]).toBeDefined();

    // Test orderedBy relationship (single)
    expect(result.docs[0].orderedBy).toBeDefined();
    expect(result.docs[0].orderedBy.firstName).toBe('Admin');

    // Test nested tenant relationship (depth: 2)
    expect(result.docs[0].orderedBy.lastLoggedInTenant).toBeDefined();
    expect(result.docs[0].orderedBy.lastLoggedInTenant.name).toBe('Test Tenant');

    // Test nested product relationship in array
    expect(result.docs[0].items).toBeDefined();
    expect(result.docs[0].items[0].product).toBeDefined();
    expect(result.docs[0].items[0].product.name).toBe('Test Product');
  });

  it('should handle depth: 0 (no relationship population)', async () => {
    const result = await payload.find({
      collection: 'posts',
      depth: 0
    });

    expect(result.docs[0]).toBeDefined();
    expect(result.docs[0].title).toBe('Test Post');

    // depth: 0 means no population, but raw FK data remains
    expect(result.docs[0].authors).toEqual(['user-1', 'user-2']);
  });
});