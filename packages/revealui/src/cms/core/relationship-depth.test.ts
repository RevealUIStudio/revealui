import { describe, it, expect, beforeEach } from 'vitest';
import { createRevealUIInstance } from './revealui';
import type { RevealConfig, RevealCollectionConfig } from '../types';

// Mock database for testing
const mockDb = {
  query: async (query: string, values: unknown[] = []) => {
    // Mock some basic responses
    if (query.includes('SELECT') && query.includes('posts')) {
      return {
        rows: [{
          id: 'post-1',
          title: 'Test Post',
          author_id: 'user-1',
          'author.title': 'John Doe',
          'author.id': 'user-1'
        }],
        rowCount: 1
      };
    }
    return { rows: [], rowCount: 0 };
  },
  init: async () => {},
  connect: async () => {},
};

// Test configuration
const testConfig: RevealConfig = {
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
};

describe('Relationship Depth Support', () => {
  let revealui: any;

  beforeEach(async () => {
    revealui = await createRevealUIInstance(testConfig);
  });

  it('should validate depth parameter range', async () => {
    // Test invalid depth values
    await expect(revealui.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: -1
    })).rejects.toThrow('Depth must be between 0 and 3');

    await expect(revealui.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 5
    })).rejects.toThrow('Depth must be between 0 and 3');
  });

  it('should work with depth 0 (no relationships)', async () => {
    const result = await revealui.findByID({
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

  it('should populate relationships with depth 1', async () => {
    const result = await revealui.findByID({
      collection: 'posts',
      id: 'post-1',
      depth: 1
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
    const { flattenResult } = await import('./revealui');

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
});