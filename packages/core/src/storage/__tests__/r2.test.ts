import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-s3 — capture S3Client constructor args + every command
// sent, return canned responses from a queue per command type.
// ---------------------------------------------------------------------------
const s3ConstructorArgs: unknown[] = [];
const sendCalls: Array<{ command: string; input: unknown }> = [];
const listResponses: unknown[] = [];

vi.mock('@aws-sdk/client-s3', () => {
  class FakeS3Client {
    constructor(args: unknown) {
      s3ConstructorArgs.push(args);
    }
    async send(command: { __command: string; input: unknown }): Promise<unknown> {
      sendCalls.push({ command: command.__command, input: command.input });
      if (command.__command === 'ListObjectsV2Command') {
        return listResponses.shift() ?? { Contents: [], IsTruncated: false };
      }
      return {};
    }
  }
  const wrap = (name: string) => {
    return class {
      readonly __command = name;
      constructor(public input: unknown) {}
    };
  };
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: wrap('PutObjectCommand'),
    DeleteObjectCommand: wrap('DeleteObjectCommand'),
    ListObjectsV2Command: wrap('ListObjectsV2Command'),
  };
});

import { createR2Provider } from '../r2.js';
import type { R2Config } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function baseConfig(overrides: Partial<R2Config> = {}): R2Config {
  return {
    accountId: 'acct-123',
    accessKeyId: 'AKIA-TEST',
    secretAccessKey: 'secret-test',
    bucket: 'media',
    publicBaseUrl: 'https://media.revealui.com',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createR2Provider', () => {
  beforeEach(() => {
    s3ConstructorArgs.length = 0;
    sendCalls.length = 0;
    listResponses.length = 0;
  });

  describe('construction', () => {
    it('throws if publicBaseUrl is missing', () => {
      expect(() => createR2Provider(baseConfig({ publicBaseUrl: undefined }))).toThrow(
        /requires R2Config.publicBaseUrl/,
      );
    });

    it('configures S3Client with R2 endpoint + region="auto" + credentials', () => {
      createR2Provider(baseConfig());
      expect(s3ConstructorArgs).toHaveLength(1);
      expect(s3ConstructorArgs[0]).toEqual({
        region: 'auto',
        endpoint: 'https://acct-123.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'AKIA-TEST',
          secretAccessKey: 'secret-test',
        },
      });
    });

    it('exposes provider="r2"', () => {
      const provider = createR2Provider(baseConfig());
      expect(provider.provider).toBe('r2');
    });
  });

  describe('put', () => {
    it('sends PutObjectCommand with bucket + key + body + content-type', async () => {
      const provider = createR2Provider(baseConfig());
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await provider.put('uploads/a.bin', body, { contentType: 'image/png' });

      expect(sendCalls).toHaveLength(1);
      expect(sendCalls[0].command).toBe('PutObjectCommand');
      expect(sendCalls[0].input).toMatchObject({
        Bucket: 'media',
        Key: 'uploads/a.bin',
        Body: body,
        ContentType: 'image/png',
        ContentLength: 5,
      });

      expect(result).toEqual({
        key: 'uploads/a.bin',
        url: 'https://media.revealui.com/uploads/a.bin',
        size: 5,
        provider: 'r2',
      });
    });

    it('defaults contentType to application/octet-stream', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.put('blob', new Uint8Array([1]));
      expect(sendCalls[0].input).toMatchObject({ ContentType: 'application/octet-stream' });
    });

    it('passes cacheControl + metadata when provided', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.put('cached', new Uint8Array([1]), {
        cacheControl: 'public, max-age=3600',
        metadata: { owner: 'tester' },
      });
      expect(sendCalls[0].input).toMatchObject({
        CacheControl: 'public, max-age=3600',
        Metadata: { owner: 'tester' },
      });
    });

    it('strips trailing slash from publicBaseUrl when building result url', async () => {
      const provider = createR2Provider(baseConfig({ publicBaseUrl: 'https://cdn.example/' }));
      const result = await provider.put('a/b.txt', new Uint8Array([1]));
      expect(result.url).toBe('https://cdn.example/a/b.txt');
    });

    it('throws when access="private" is requested (Phase 2a limit)', async () => {
      const provider = createR2Provider(baseConfig());
      await expect(provider.put('p', new Uint8Array([1]), { access: 'private' })).rejects.toThrow(
        /Phase 2a does not support access: 'private'/,
      );
    });

    it('normalizes ArrayBuffer input', async () => {
      const provider = createR2Provider(baseConfig());
      const buf = new ArrayBuffer(3);
      new Uint8Array(buf).set([7, 8, 9]);
      const result = await provider.put('ab', buf);
      expect(result.size).toBe(3);
    });

    it('normalizes Blob input', async () => {
      const provider = createR2Provider(baseConfig());
      const blob = new Blob(['hi']);
      const result = await provider.put('b', blob);
      expect(result.size).toBe(2);
    });

    it('normalizes ReadableStream input', async () => {
      const provider = createR2Provider(baseConfig());
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3]));
          controller.close();
        },
      });
      const result = await provider.put('s', stream);
      expect(result.size).toBe(3);
    });
  });

  describe('del', () => {
    it('sends DeleteObjectCommand with the key when given a bare key', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.del('uploads/a.bin');
      expect(sendCalls[0]).toEqual({
        command: 'DeleteObjectCommand',
        input: { Bucket: 'media', Key: 'uploads/a.bin' },
      });
    });

    it('extracts key from a full URL', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.del('https://media.revealui.com/uploads/b.png');
      expect(sendCalls[0].input).toEqual({ Bucket: 'media', Key: 'uploads/b.png' });
    });

    it('handles URL with no path beyond root', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.del('https://media.revealui.com/');
      expect(sendCalls[0].input).toEqual({ Bucket: 'media', Key: '' });
    });
  });

  describe('list', () => {
    it('returns mapped items + cursor + hasMore from ListObjectsV2 response', async () => {
      listResponses.push({
        Contents: [
          { Key: 'media/a.jpg', Size: 1024, LastModified: new Date('2026-05-18T10:00:00Z') },
          { Key: 'media/b.jpg', Size: 2048, LastModified: new Date('2026-05-18T11:00:00Z') },
        ],
        IsTruncated: true,
        NextContinuationToken: 'next-cursor',
      });
      const provider = createR2Provider(baseConfig());
      const result = await provider.list({ prefix: 'media/', limit: 2 });

      expect(sendCalls[0]).toEqual({
        command: 'ListObjectsV2Command',
        input: {
          Bucket: 'media',
          Prefix: 'media/',
          MaxKeys: 2,
          ContinuationToken: undefined,
        },
      });
      expect(result).toEqual({
        items: [
          {
            key: 'media/a.jpg',
            url: 'https://media.revealui.com/media/a.jpg',
            size: 1024,
            uploadedAt: new Date('2026-05-18T10:00:00Z'),
          },
          {
            key: 'media/b.jpg',
            url: 'https://media.revealui.com/media/b.jpg',
            size: 2048,
            uploadedAt: new Date('2026-05-18T11:00:00Z'),
          },
        ],
        cursor: 'next-cursor',
        hasMore: true,
      });
    });

    it('defaults to maxKeys=1000 when no limit given', async () => {
      listResponses.push({ Contents: [], IsTruncated: false });
      const provider = createR2Provider(baseConfig());
      await provider.list();
      expect(sendCalls[0].input).toMatchObject({ MaxKeys: 1000 });
    });

    it('handles empty Contents response', async () => {
      listResponses.push({ Contents: [], IsTruncated: false });
      const provider = createR2Provider(baseConfig());
      const result = await provider.list();
      expect(result).toEqual({ items: [], cursor: undefined, hasMore: false });
    });

    it('omits entries without a Key', async () => {
      listResponses.push({
        Contents: [
          { Key: 'a', Size: 1, LastModified: new Date('2026-01-01') },
          { Size: 5, LastModified: new Date('2026-01-02') }, // bogus row
        ],
        IsTruncated: false,
      });
      const provider = createR2Provider(baseConfig());
      const result = await provider.list();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].key).toBe('a');
    });

    it('falls back to epoch when LastModified is missing', async () => {
      listResponses.push({
        Contents: [{ Key: 'a', Size: 1 }],
        IsTruncated: false,
      });
      const provider = createR2Provider(baseConfig());
      const result = await provider.list();
      expect(result.items[0].uploadedAt).toEqual(new Date(0));
    });

    it('falls back to size=0 when Size is missing', async () => {
      listResponses.push({
        Contents: [{ Key: 'a', LastModified: new Date('2026-01-01') }],
        IsTruncated: false,
      });
      const provider = createR2Provider(baseConfig());
      const result = await provider.list();
      expect(result.items[0].size).toBe(0);
    });

    it('passes cursor through as ContinuationToken', async () => {
      listResponses.push({ Contents: [], IsTruncated: false });
      const provider = createR2Provider(baseConfig());
      await provider.list({ cursor: 'resume-from' });
      expect(sendCalls[0].input).toMatchObject({ ContinuationToken: 'resume-from' });
    });
  });
});
