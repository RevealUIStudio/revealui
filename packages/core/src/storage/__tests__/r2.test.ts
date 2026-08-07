// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createR2Provider } from '../r2.js';
import type { R2Config } from '../types.js';

// ---------------------------------------------------------------------------
// Mock global fetch — capture every request (url + method + lowercased headers
// + body) and return canned Responses from a queue.
// ---------------------------------------------------------------------------
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let requests: CapturedRequest[];
let responseQueue: Response[];

beforeEach(() => {
  requests = [];
  responseQueue = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    const raw = init?.headers;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, string>)) {
        headers[k.toLowerCase()] = v;
      }
    }
    requests.push({ url, method: init?.method ?? 'GET', headers, body: init?.body });
    return Promise.resolve(responseQueue.shift() ?? new Response('', { status: 200 }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

function queueResponse(body: string, status = 200): void {
  responseQueue.push(new Response(body, { status }));
}

describe('createR2Provider', () => {
  describe('construction', () => {
    it('throws if publicBaseUrl is missing', () => {
      expect(() => createR2Provider(baseConfig({ publicBaseUrl: undefined }))).toThrow(
        /requires R2Config.publicBaseUrl/,
      );
    });

    it('exposes provider="r2"', () => {
      expect(createR2Provider(baseConfig()).provider).toBe('r2');
    });

    it('signs requests for the R2 path-style endpoint with region=auto + service=s3', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.put('k', new Uint8Array([1]));
      expect(requests[0].url).toBe('https://acct-123.r2.cloudflarestorage.com/media/k');
      expect(requests[0].headers.authorization).toContain('AWS4-HMAC-SHA256 Credential=AKIA-TEST/');
      expect(requests[0].headers.authorization).toContain('/auto/s3/aws4_request');
      expect(requests[0].headers.authorization).toContain('Signature=');
      expect(requests[0].headers['x-amz-content-sha256']).toBeDefined();
    });
  });

  describe('put', () => {
    it('PUTs to the object URL with body + content-type and returns the public URL', async () => {
      const provider = createR2Provider(baseConfig());
      const body = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await provider.put('uploads/a.bin', body, { contentType: 'image/png' });

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('PUT');
      expect(requests[0].url).toBe('https://acct-123.r2.cloudflarestorage.com/media/uploads/a.bin');
      expect(requests[0].headers['content-type']).toBe('image/png');
      // No manual content-length: it is a forbidden fetch header (undici computes
      // it from the body) and setting it throws UND_ERR_INVALID_ARG on a live R2 PUT.
      expect(requests[0].headers['content-length']).toBeUndefined();
      expect(requests[0].body).toBe(body);

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
      expect(requests[0].headers['content-type']).toBe('application/octet-stream');
    });

    it('sends cacheControl + metadata as signed headers when provided', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.put('cached', new Uint8Array([1]), {
        cacheControl: 'public, max-age=3600',
        metadata: { owner: 'tester' },
      });
      expect(requests[0].headers['cache-control']).toBe('public, max-age=3600');
      expect(requests[0].headers['x-amz-meta-owner']).toBe('tester');
    });

    it('strips trailing slash from publicBaseUrl when building result url', async () => {
      const provider = createR2Provider(baseConfig({ publicBaseUrl: 'https://cdn.example/' }));
      const result = await provider.put('a/b.txt', new Uint8Array([1]));
      expect(result.url).toBe('https://cdn.example/a/b.txt');
    });

    it('throws when access="private" is requested without sending a request', async () => {
      const provider = createR2Provider(baseConfig());
      await expect(provider.put('p', new Uint8Array([1]), { access: 'private' })).rejects.toThrow(
        /does not support access: 'private'/,
      );
      expect(requests).toHaveLength(0);
    });

    it('throws with the S3 error code on a non-2xx response', async () => {
      queueResponse('<Error><Code>AccessDenied</Code><Message>nope</Message></Error>', 403);
      const provider = createR2Provider(baseConfig());
      await expect(provider.put('p', new Uint8Array([1]))).rejects.toThrow(/AccessDenied/);
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
      const result = await provider.put('b', new Blob(['hi']));
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
    it('DELETEs the key when given a bare key', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.del('uploads/a.bin');
      expect(requests[0].method).toBe('DELETE');
      expect(requests[0].url).toBe('https://acct-123.r2.cloudflarestorage.com/media/uploads/a.bin');
    });

    it('extracts the key from a full URL', async () => {
      const provider = createR2Provider(baseConfig());
      await provider.del('https://media.revealui.com/uploads/b.png');
      expect(requests[0].url).toBe('https://acct-123.r2.cloudflarestorage.com/media/uploads/b.png');
    });

    it('treats a 404 as success (best-effort delete)', async () => {
      queueResponse('<Error><Code>NoSuchKey</Code></Error>', 404);
      const provider = createR2Provider(baseConfig());
      await expect(provider.del('missing')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    const LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>next-cursor</NextContinuationToken>
  <Contents><Key>media/a.jpg</Key><LastModified>2026-05-18T10:00:00.000Z</LastModified><Size>1024</Size></Contents>
  <Contents><Key>media/b.jpg</Key><LastModified>2026-05-18T11:00:00.000Z</LastModified><Size>2048</Size></Contents>
</ListBucketResult>`;

    it('maps items + cursor + hasMore and sends list-type=2 + prefix + max-keys', async () => {
      queueResponse(LIST_XML);
      const provider = createR2Provider(baseConfig());
      const result = await provider.list({ prefix: 'media/', limit: 2 });

      expect(requests[0].method).toBe('GET');
      expect(requests[0].url).toBe(
        'https://acct-123.r2.cloudflarestorage.com/media?list-type=2&max-keys=2&prefix=media%2F',
      );
      expect(result).toEqual({
        items: [
          {
            key: 'media/a.jpg',
            url: 'https://media.revealui.com/media/a.jpg',
            size: 1024,
            uploadedAt: new Date('2026-05-18T10:00:00.000Z'),
          },
          {
            key: 'media/b.jpg',
            url: 'https://media.revealui.com/media/b.jpg',
            size: 2048,
            uploadedAt: new Date('2026-05-18T11:00:00.000Z'),
          },
        ],
        cursor: 'next-cursor',
        hasMore: true,
      });
    });

    it('defaults to max-keys=1000 when no limit is given', async () => {
      queueResponse('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
      const provider = createR2Provider(baseConfig());
      await provider.list();
      expect(requests[0].url).toContain('max-keys=1000');
    });

    it('handles an empty result', async () => {
      queueResponse('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
      const provider = createR2Provider(baseConfig());
      const result = await provider.list();
      expect(result).toEqual({ items: [], cursor: undefined, hasMore: false });
    });

    it('passes the cursor through as continuation-token', async () => {
      queueResponse('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
      const provider = createR2Provider(baseConfig());
      await provider.list({ cursor: 'resume-from' });
      expect(requests[0].url).toContain('continuation-token=resume-from');
    });
  });

  describe('createPresignedPutUrl', () => {
    it('returns a query-string SigV4 URL with content-type signed and no network call', async () => {
      const provider = createR2Provider(baseConfig());
      const now = new Date('2026-05-18T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const result = await provider.createPresignedPutUrl({
        key: 'media/uuid.png',
        contentType: 'image/png',
        expiresInSeconds: 600,
      });

      expect(requests).toHaveLength(0);
      expect(result.key).toBe('media/uuid.png');
      expect(result.headers['content-type']).toBe('image/png');
      expect(result.expiresAt.getTime()).toBe(now.getTime() + 600_000);
      expect(result.url).toContain(
        'https://acct-123.r2.cloudflarestorage.com/media/media/uuid.png?',
      );
      expect(result.url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(result.url).toContain('X-Amz-Expires=600');
      expect(result.url).toContain('X-Amz-SignedHeaders=content-type%3Bhost');
      expect(result.url).toContain('X-Amz-Signature=');
      expect(result.url).toContain(
        'X-Amz-Credential=AKIA-TEST%2F20260518%2Fauto%2Fs3%2Faws4_request',
      );

      vi.useRealTimers();
    });

    it('includes content-length in signed headers when provided', async () => {
      const provider = createR2Provider(baseConfig());
      const result = await provider.createPresignedPutUrl({
        key: 'media/big.mp4',
        contentType: 'video/mp4',
        contentLength: 30_000_000,
      });
      expect(result.headers['content-length']).toBe('30000000');
      expect(result.url).toContain('content-length');
    });

    it('rejects non-positive expiresInSeconds', async () => {
      const provider = createR2Provider(baseConfig());
      await expect(
        provider.createPresignedPutUrl({
          key: 'k',
          contentType: 'image/png',
          expiresInSeconds: 0,
        }),
      ).rejects.toThrow(/expiresInSeconds must be positive/);
    });
  });

  describe('headObject', () => {
    it('HEADs the object and returns size + contentType + public url', async () => {
      responseQueue.push(
        new Response(null, {
          status: 200,
          headers: {
            'content-length': '2048',
            'content-type': 'image/png',
          },
        }),
      );
      const provider = createR2Provider(baseConfig());
      const result = await provider.headObject('media/a.png');

      expect(requests[0].method).toBe('HEAD');
      expect(requests[0].url).toBe('https://acct-123.r2.cloudflarestorage.com/media/media/a.png');
      expect(result).toEqual({
        size: 2048,
        contentType: 'image/png',
        url: 'https://media.revealui.com/media/a.png',
      });
    });

    it('throws NoSuchKey on 404', async () => {
      queueResponse('', 404);
      const provider = createR2Provider(baseConfig());
      await expect(provider.headObject('missing')).rejects.toThrow(/NoSuchKey/);
    });
  });

  describe('getObjectRange', () => {
    it('GETs with a Range header and returns the body bytes', async () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      responseQueue.push(new Response(bytes, { status: 206 }));
      const provider = createR2Provider(baseConfig());
      const result = await provider.getObjectRange('media/a.png', 0, 15);

      expect(requests[0].method).toBe('GET');
      expect(requests[0].headers.range).toBe('bytes=0-15');
      expect(result).toEqual(bytes);
    });

    it('rejects inverted ranges without sending a request', async () => {
      const provider = createR2Provider(baseConfig());
      await expect(provider.getObjectRange('k', 10, 5)).rejects.toThrow(/invalid range/);
      expect(requests).toHaveLength(0);
    });
  });
});
