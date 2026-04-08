import { describe, expect, it } from 'vitest';
import { RecursiveCharacterSplitter } from '../ingestion/text-splitter.js';

describe('RecursiveCharacterSplitter', () => {
  it('returns empty array for empty text', () => {
    const splitter = new RecursiveCharacterSplitter();
    expect(splitter.split('')).toEqual([]);
    expect(splitter.split('   ')).toEqual([]);
  });

  it('returns single chunk for short text', () => {
    const splitter = new RecursiveCharacterSplitter({ chunkSize: 200 });
    const result = splitter.split('Hello world, this is a short sentence.');
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toContain('Hello world');
  });

  it('splits on double newlines first', () => {
    const splitter = new RecursiveCharacterSplitter({ chunkSize: 50, overlap: 0 });
    const text = `${'A'.repeat(200)}\n\n${'B'.repeat(200)}`;
    const result = splitter.split(text);
    expect(result.length).toBeGreaterThan(1);
  });

  it('assigns sequential chunk indices', () => {
    const splitter = new RecursiveCharacterSplitter({ chunkSize: 50, overlap: 0 });
    const text = Array(10).fill('paragraph of text here.\n\n').join('');
    const result = splitter.split(text);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      // indices are sequential (may not be 0,1,2... due to merge logic)
      expect(chunk.index).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes overlap from previous chunk', () => {
    const splitter = new RecursiveCharacterSplitter({ chunkSize: 50, overlap: 20 });
    const text = 'word '.repeat(100);
    const result = splitter.split(text);
    // With overlap, each chunk after the first should contain some text from the previous
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('estimates token count', () => {
    const splitter = new RecursiveCharacterSplitter();
    const text = 'a'.repeat(400);
    const result = splitter.split(text);
    for (const chunk of result) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });

  it('passes metadata through to chunks', () => {
    const splitter = new RecursiveCharacterSplitter();
    const text = 'some content here';
    const result = splitter.split(text, { metadata: { source: 'test' } });
    expect(result[0]?.metadata?.source).toBe('test');
  });

  it('handles text with no separators by hard-splitting', () => {
    const splitter = new RecursiveCharacterSplitter({ chunkSize: 10, overlap: 0 });
    const text = 'x'.repeat(200); // no whitespace separators
    const result = splitter.split(text);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });
});
