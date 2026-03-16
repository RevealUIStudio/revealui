/**
 * Unit tests for flattenResult utility
 *
 * Tests actual utility from packages/core/src/utils/flattenResult.ts
 */

import { describe, expect, it } from 'vitest';
import type { RevealDocument } from '../../../../../packages/core/src/types/index.js';
import { flattenResult } from '../../../../../packages/core/src/utils/flattenResult.js';

describe('flattenResult', () => {
  const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

  it('should flatten dotted notation to nested objects', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.title': 'John Doe',
      'author.id': 'author-1',
      title: 'Test Post',
    };

    const result = flattenResult(doc);

    expect(result.id).toBe('1');
    expect(result.title).toBe('Test Post');
    expect(result.author).toBeDefined();
    const author = asRecord(result.author);
    expect(author.title).toBe('John Doe');
    expect(author.id).toBe('author-1');
    expect(result['author.title']).toBeUndefined();
    expect(result['author.id']).toBeUndefined();
  });

  it('should handle multiple dotted keys', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.name': 'John',
      'author.email': 'john@example.com',
      'category.name': 'Tech',
      'category.slug': 'tech',
    };

    const result = flattenResult(doc);

    expect(result.author).toBeDefined();
    const author = asRecord(result.author);
    expect(author.name).toBe('John');
    expect(author.email).toBe('john@example.com');
    expect(result.category).toBeDefined();
    const category = asRecord(result.category);
    expect(category.name).toBe('Tech');
    expect(category.slug).toBe('tech');
  });

  it('should handle nested dotted notation', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.name': 'John',
      'author.age': 30,
    };

    const result = flattenResult(doc);

    // Should only split on first dot
    expect(result.author).toBeDefined();
    const author = asRecord(result.author);
    expect(author.name).toBe('John');
    expect(author.age).toBe(30);
  });

  it('should preserve non-dotted keys', () => {
    const doc: RevealDocument = {
      id: '1',
      title: 'Test',
      content: 'Content',
      createdAt: '2024-01-01',
    };

    const result = flattenResult(doc);

    expect(result.id).toBe('1');
    expect(result.title).toBe('Test');
    expect(result.content).toBe('Content');
    expect(result.createdAt).toBe('2024-01-01');
  });

  it('should handle empty object', () => {
    const doc: RevealDocument = { id: '' };

    const result = flattenResult(doc);

    expect(result).toEqual({ id: '' });
  });

  it('should handle object with only dotted keys', () => {
    const doc: RevealDocument = {
      id: 'doc-1',
      'field1.value': 'value1',
      'field2.value': 'value2',
    };

    const result = flattenResult(doc);

    expect(result.field1).toBeDefined();
    const field1 = asRecord(result.field1);
    expect(field1.value).toBe('value1');
    expect(result.field2).toBeDefined();
    const field2 = asRecord(result.field2);
    expect(field2.value).toBe('value2');
  });

  it('should handle object with mixed key types', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.name': 'John',
      simpleKey: 'value',
      'another.nested': 'nested value',
    };

    const result = flattenResult(doc);

    expect(result.id).toBe('1');
    expect(result.simpleKey).toBe('value');
    expect(result.author).toBeDefined();
    const author = asRecord(result.author);
    expect(author.name).toBe('John');
    expect(result.another).toBeDefined();
    const another = asRecord(result.another);
    expect(another.nested).toBe('nested value');
  });

  it('should not modify original document', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.name': 'John',
    };

    const originalDoc = { ...doc };
    const result = flattenResult(doc);

    // Original should be unchanged
    expect(doc).toEqual(originalDoc);
    expect(result).not.toBe(doc); // Should be a copy
  });

  it('should handle array values', () => {
    const doc: RevealDocument = {
      id: '1',
      'tags.items': ['tag1', 'tag2'],
    };

    const result = flattenResult(doc);

    expect(result.tags).toBeDefined();
    const tags = asRecord(result.tags);
    expect(tags.items).toEqual(['tag1', 'tag2']);
  });

  it('should handle null and undefined values', () => {
    const doc: RevealDocument = {
      id: '1',
      'author.name': null,
      'author.email': undefined,
    };

    const result = flattenResult(doc);

    expect(result.author).toBeDefined();
    const author = asRecord(result.author);
    expect(author.name).toBeNull();
    expect(author.email).toBeUndefined();
  });
});
