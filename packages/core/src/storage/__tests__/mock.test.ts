import { beforeEach, describe, expect, it } from 'vitest';
import { createMockProvider, type MockProvider } from '../mock.js';

describe('createMockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = createMockProvider();
  });

  describe('provider tag', () => {
    it('exposes provider="mock"', () => {
      expect(provider.provider).toBe('mock');
    });
  });

  describe('put', () => {
    it('stores Uint8Array payloads', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await provider.put('foo/bar.bin', data);

      expect(result.key).toBe('foo/bar.bin');
      expect(result.url).toBe('mock://storage/foo/bar.bin');
      expect(result.size).toBe(4);
      expect(result.provider).toBe('mock');
      expect(provider.read('foo/bar.bin')).toEqual(data);
    });

    it('stores ArrayBuffer payloads', async () => {
      const buf = new ArrayBuffer(8);
      new Uint8Array(buf).set([10, 20, 30, 40, 50, 60, 70, 80]);
      const result = await provider.put('buf.bin', buf);

      expect(result.size).toBe(8);
      expect(provider.read('buf.bin')).toEqual(new Uint8Array(buf));
    });

    it('stores Blob payloads', async () => {
      const blob = new Blob(['hello world']);
      const result = await provider.put('blob.txt', blob);

      expect(result.size).toBe(11);
      const stored = provider.read('blob.txt');
      expect(stored).toBeDefined();
      expect(new TextDecoder().decode(stored)).toBe('hello world');
    });

    it('stores ReadableStream payloads', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5]));
          controller.close();
        },
      });
      const result = await provider.put('stream.bin', stream);

      expect(result.size).toBe(5);
      expect(provider.read('stream.bin')).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('captures contentType + cacheControl + metadata', async () => {
      await provider.put('meta.bin', new Uint8Array([1]), {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
        metadata: { author: 'tester', source: 'unit-test' },
      });

      const entry = provider.inspect('meta.bin');
      expect(entry?.contentType).toBe('image/png');
      expect(entry?.cacheControl).toBe('public, max-age=31536000');
      expect(entry?.metadata).toEqual({ author: 'tester', source: 'unit-test' });
    });

    it('defaults contentType to application/octet-stream', async () => {
      await provider.put('default.bin', new Uint8Array([1]));
      expect(provider.inspect('default.bin')?.contentType).toBe('application/octet-stream');
    });

    it('overwrites existing key', async () => {
      await provider.put('key', new Uint8Array([1, 2, 3]));
      await provider.put('key', new Uint8Array([9]));
      expect(provider.read('key')).toEqual(new Uint8Array([9]));
      expect(provider.size()).toBe(1);
    });
  });

  describe('del', () => {
    it('deletes by key', async () => {
      await provider.put('to-delete', new Uint8Array([1]));
      expect(provider.size()).toBe(1);
      await provider.del('to-delete');
      expect(provider.size()).toBe(0);
    });

    it('deletes by mock URL', async () => {
      await provider.put('to-delete', new Uint8Array([1]));
      await provider.del('mock://storage/to-delete');
      expect(provider.size()).toBe(0);
    });

    it('is a no-op for missing keys (best-effort contract)', async () => {
      await expect(provider.del('never-existed')).resolves.toBeUndefined();
      await expect(provider.del('mock://storage/also-missing')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await provider.put('a/1.txt', new Uint8Array([1]));
      await provider.put('a/2.txt', new Uint8Array([1, 2]));
      await provider.put('a/3.txt', new Uint8Array([1, 2, 3]));
      await provider.put('b/1.txt', new Uint8Array([1, 2, 3, 4]));
    });

    it('lists all items when no opts given', async () => {
      const result = await provider.list();
      expect(result.items.map((i) => i.key)).toEqual(['a/1.txt', 'a/2.txt', 'a/3.txt', 'b/1.txt']);
      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeUndefined();
    });

    it('filters by prefix', async () => {
      const result = await provider.list({ prefix: 'a/' });
      expect(result.items.map((i) => i.key)).toEqual(['a/1.txt', 'a/2.txt', 'a/3.txt']);
      expect(result.hasMore).toBe(false);
    });

    it('returns empty list for non-matching prefix', async () => {
      const result = await provider.list({ prefix: 'nothing/' });
      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('paginates with limit + cursor', async () => {
      const page1 = await provider.list({ limit: 2 });
      expect(page1.items.map((i) => i.key)).toEqual(['a/1.txt', 'a/2.txt']);
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBe('a/2.txt');

      const page2 = await provider.list({ limit: 2, cursor: page1.cursor });
      expect(page2.items.map((i) => i.key)).toEqual(['a/3.txt', 'b/1.txt']);
      expect(page2.hasMore).toBe(false);
    });

    it('returns size + url + uploadedAt for each item', async () => {
      const result = await provider.list({ prefix: 'a/1' });
      expect(result.items[0]).toMatchObject({
        key: 'a/1.txt',
        url: 'mock://storage/a/1.txt',
        size: 1,
      });
      expect(result.items[0].uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe('test helpers', () => {
    it('size() returns object count', async () => {
      expect(provider.size()).toBe(0);
      await provider.put('a', new Uint8Array([1]));
      await provider.put('b', new Uint8Array([2]));
      expect(provider.size()).toBe(2);
    });

    it('clear() wipes the store', async () => {
      await provider.put('a', new Uint8Array([1]));
      provider.clear();
      expect(provider.size()).toBe(0);
      expect(provider.read('a')).toBeUndefined();
    });

    it('inspect() returns the full entry or undefined', async () => {
      await provider.put('x', new Uint8Array([1]), { contentType: 'text/plain' });
      expect(provider.inspect('x')?.contentType).toBe('text/plain');
      expect(provider.inspect('missing')).toBeUndefined();
    });
  });
});
