import { describe, it, expect, beforeEach } from 'vitest';
import { createRevealUIPayload, getRelationshipFields } from '@revealui/core/cms/core/payload';
import type { RevealConfig, RevealCollectionConfig } from '@revealui/core/cms/types';

// Mock database for testing
const mockDb = {
  query: async (query: string, values: unknown[] = []) => {
    // Mock some basic responses - all queries now return simple data
    // DataLoader handles the population separately
    if (query.includes('SELECT') && query.includes('posts')) {
      return {
        rows: [{
          id: 'post-1',
          title: 'Test Post',
          author_id: 'user-1'
        }],
        rowCount: 1
      };
    } else if (query.includes('SELECT') && query.includes('users')) {
      return {
        rows: [{
          id: 'user-1',
          title: 'John Doe'
        }],
        rowCount: 1
      };
    }
    return { rows: [], rowCount: 0 };
  },
  init: async () => {},
  connect: async () => {},
};

// Test configuration factory
const createBaseTestConfig = (): RevealConfig => ({
  collections: [
    {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'users',
          hasMany: false
        }
      ]
    } as RevealCollectionConfig,
    {
      slug: 'users',
      fields: [
        { name: 'title', type: 'text', required: true } // Using title as name for simplicity
      ]
    } as RevealCollectionConfig
  ],
  db: mockDb as any
});

const createRecursiveDepthTestConfig = (): RevealConfig => {
  const config = createBaseTestConfig();

  // Add profile relationship to users
  const usersCollection = config.collections?.find(c => c.slug === 'users');
  if (usersCollection) {
    usersCollection.fields.push({
      name: 'profile',
      type: 'relationship',
      relationTo: 'profiles',
      hasMany: false
    });
  }

  // Add profiles collection
  config.collections?.push({
    slug: 'profiles',
    fields: [
      { name: 'bio', type: 'text', required: false }
    ]
  } as RevealCollectionConfig);

  return config;
};

// Mock DataLoader factory for testing
const createBaseDataLoader = () => ({
  load: async (cacheKey: string) => {
    // Parse cache key to determine what to return
    const parsed = JSON.parse(cacheKey);
    if (parsed[2] === 'user-1') { // docID is at index 2
      return {
        id: 'user-1',
        title: 'John Doe'
      };
    }
    return null;
  },
  find: async (args: any) => {
    // Mock find operation
    return { docs: [] };
  }
});

const createRecursiveDepthDataLoader = () => ({
  load: async (cacheKey: string) => {
    try {
      const parsed = JSON.parse(cacheKey);
      if (parsed[2] === 'profile-1') {
        return { id: 'profile-1', bio: 'Software developer' };
      }
      if (parsed[2] === 'user-1') {
        return { id: 'user-1', title: 'John Doe', profile_id: 'profile-1' };
      }
    } catch (e) {
      // Invalid cache key
    }
    return null;
  },
  find: async (args: any) => {
    // Mock find operation
    return { docs: [] };
  }
});

describe('Relationship Depth Support', () => {
  let payload: any;
  let mockDataLoader: any;

  beforeEach(async () => {
    const testConfig = createBaseTestConfig();
    mockDataLoader = createBaseDataLoader();
    payload = await createRevealUIPayload(testConfig);
  });

  it('should validate depth parameter range', async () => {
    // Test invalid depth values
    await expect(payload.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: -1
    })).rejects.toThrow('Depth must be between 0 and 3');

    await expect(payload.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 5
    })).rejects.toThrow('Depth must be between 0 and 3');
  });

  it('should work with depth 0 (no relationships)', async () => {
    const result = await payload.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 0
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe('post-1');
    expect(result?.title).toBe('Test Post');
    // Should not have populated author relationship
    expect(result?.author).toBeUndefined();
  });

  it('should detect relationships correctly', () => {
    const testConfig = createBaseTestConfig();
    const postsCollection = testConfig.collections?.find(c => c.slug === 'posts');
    expect(postsCollection).toBeDefined();

    const relationships = getRelationshipFields(postsCollection!, 'posts');
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      fieldName: 'author',
      storageType: 'direct_fk',
      relationTo: 'users',
      hasMany: false
    });
  });

  it('should populate relationships with depth 1', async () => {
    // Create a mock request with DataLoader
    const mockReq = {
      payload: payload,
      transactionID: 'test-tx',
      context: {},
      locale: 'en',
      fallbackLocale: 'en',
      payloadDataLoader: mockDataLoader
    };

    const result = await payload.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 1,
      req: mockReq
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe('post-1');
    expect(result?.title).toBe('Test Post');
    // Should have populated author relationship
    expect(result?.author).toEqual({
      id: 'user-1',
      title: 'John Doe'
    });
  });

  it('should flatten dotted notation results', async () => {
    // Test the flattenResult function directly
    const { flattenResult } = await import('@revealui/core/cms/core/payload');

    const input = {
      id: 'post-1',
      title: 'Test Post',
      'author.title': 'John Doe',
      'author.id': 'user-1',
      'category.name': 'Tech'
    };

    const result = flattenResult(input);

    expect(result).toEqual({
      id: 'post-1',
      title: 'Test Post',
      author: {
        title: 'John Doe',
        id: 'user-1'
      },
      category: {
        name: 'Tech'
      }
    });
  });

  it('should populate relationships in find() results', async () => {
    const mockReq = {
      payload: payload,
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

    // Should populate author relationship
    expect(result.docs[0]?.author).toBeDefined();
    expect(result.docs[0]?.author.title).toBe('John Doe');
  });

  it('should support recursive depth in findByID', async () => {
    // Create isolated config and DataLoader for this test
    const recursiveConfig = createRecursiveDepthTestConfig();
    const recursiveDataLoader = createRecursiveDepthDataLoader();
    const recursivePayload = await createRevealUIPayload(recursiveConfig);

    const mockReq = {
      payload: recursivePayload,
      transactionID: 'test-tx',
      context: {},
      locale: 'en',
      fallbackLocale: 'en',
      payloadDataLoader: recursiveDataLoader
    };

    const result = await recursivePayload.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 2,
      req: mockReq
    });

    // Should populate nested relationships: post.author.profile
    expect(result?.author).toBeDefined();
    expect(result?.author.profile).toBeDefined();
    expect(result?.author.profile.bio).toBe('Software developer');
  });
});