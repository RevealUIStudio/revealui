/**
 * Cloudflare R2 implementation of StorageProvider.
 *
 * R2 is S3-compatible. This is a native client: AWS SigV4 request signing
 * (./_sigv4.ts, verified against AWS's official test vector) over global
 * `fetch`, plus a small XML reader for ListObjectsV2 (./_xml.ts). No SDK
 * dependency — only node:crypto + fetch.
 *
 * Path-style addressing is used for the S3 API calls
 * (https://<account>.r2.cloudflarestorage.com/<bucket>/<key>); this has no
 * effect on the public object URLs, which are built from `publicBaseUrl`.
 *
 * GAP-208 Phase 2a (2026-05-18). Phase 1 (interface + types) shipped in #959.
 * Native client (dropping @aws-sdk/client-s3) landed 2026-06-09.
 * Phase 2b (GAP-215): createPresignedPutUrl + headObject + getObjectRange for
 * direct-to-R2 media uploads.
 *
 * Server-only. Do NOT import from client-side code or edge runtime.
 *
 * Known limitation: request bodies for server-side put() are buffered fully in
 * memory (see toUint8Array) so the payload can be hashed for SigV4. Streaming
 * uploads (STREAMING-AWS4-HMAC-SHA256-PAYLOAD) are a future enhancement.
 * Direct client uploads use createPresignedPutUrl and never buffer in the API.
 */

import { toUint8Array } from './_helpers.js';
import { EMPTY_SHA256, sha256Hex, signS3PresignedUrl, signS3Request } from './_sigv4.js';
import { parseListObjectsV2, s3ErrorFields } from './_xml.js';
import type {
  HeadObjectResult,
  ListItem,
  ListOptions,
  ListResult,
  PresignPutOptions,
  PresignPutResult,
  PutOptions,
  PutResult,
  R2Config,
  StorageProvider,
} from './types.js';

const PROVIDER_TAG = 'r2';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const DEFAULT_LIST_LIMIT = 1000;
const DEFAULT_PRESIGN_EXPIRES_SECONDS = 900;
const REGION = 'auto';

class R2Provider implements StorageProvider {
  readonly provider = PROVIDER_TAG;
  private readonly accountId: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: R2Config) {
    if (!config.publicBaseUrl) {
      throw new Error(
        'R2 provider requires R2Config.publicBaseUrl for public media URLs after ' +
          'upload. Set publicBaseUrl to either a bound custom domain ' +
          "(e.g. 'https://media.revealui.com') or the R2 dev URL " +
          "('https://<account-id>.r2.cloudflarestorage.com/<bucket>').",
      );
    }

    this.accountId = config.accountId;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucket = config.bucket;
    this.publicBaseUrl = stripTrailingSlash(config.publicBaseUrl);
  }

  async put(
    key: string,
    data: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    opts?: PutOptions,
  ): Promise<PutResult> {
    if (opts?.access === 'private') {
      throw new Error(
        "R2 provider does not support access: 'private' for put(). Use " +
          'createPresignedPutUrl for client direct uploads; public object URLs ' +
          'still use publicBaseUrl after confirm.',
      );
    }

    const body = await toUint8Array(data);

    const extraHeaders: Record<string, string> = {
      'content-type': opts?.contentType ?? DEFAULT_CONTENT_TYPE,
    };
    if (opts?.cacheControl) {
      extraHeaders['cache-control'] = opts.cacheControl;
    }
    for (const [name, value] of Object.entries(opts?.metadata ?? {})) {
      extraHeaders[`x-amz-meta-${name.toLowerCase()}`] = value;
    }

    const { url, headers } = signS3Request({
      method: 'PUT',
      accountId: this.accountId,
      bucket: this.bucket,
      key,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: sha256Hex(body),
      extraHeaders,
      now: new Date(),
    });

    // No manual content-length: it is a forbidden fetch header that undici
    // computes from the body itself, and setting it throws UND_ERR_INVALID_ARG
    // ("invalid content-length header") on the R2 PUT. `headers` already carries
    // the signed set. `as BodyInit` bridges the TS lib's ArrayBufferLike vs
    // ArrayBuffer typed-array variance for fetch bodies (cf. src/api/compression.ts).
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body as BodyInit,
    });
    if (!response.ok) {
      throw await storageError('PUT', key, response);
    }

    return {
      key,
      url: this.objectPublicUrl(key),
      size: body.byteLength,
      provider: PROVIDER_TAG,
    };
  }

  async createPresignedPutUrl(opts: PresignPutOptions): Promise<PresignPutResult> {
    const expiresInSeconds = opts.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
    if (expiresInSeconds <= 0) {
      throw new Error('createPresignedPutUrl: expiresInSeconds must be positive');
    }

    const signedHeaders: Record<string, string> = {
      'content-type': opts.contentType,
    };
    if (opts.contentLength !== undefined) {
      signedHeaders['content-length'] = String(opts.contentLength);
    }

    const now = new Date();
    const { url, headers } = signS3PresignedUrl({
      method: 'PUT',
      accountId: this.accountId,
      bucket: this.bucket,
      key: opts.key,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      expiresInSeconds,
      signedHeaders,
      now,
    });

    return {
      url,
      headers,
      key: opts.key,
      expiresAt: new Date(now.getTime() + expiresInSeconds * 1000),
    };
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    const { url, headers } = signS3Request({
      method: 'HEAD',
      accountId: this.accountId,
      bucket: this.bucket,
      key,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: EMPTY_SHA256,
      now: new Date(),
    });

    const response = await fetch(url, { method: 'HEAD', headers });
    if (response.status === 404) {
      throw new Error(`R2 HEAD failed for "${key}": NoSuchKey object not found`);
    }
    if (!response.ok) {
      throw await storageError('HEAD', key, response);
    }

    const lengthHeader = response.headers.get('content-length');
    const size = lengthHeader === null ? 0 : Number(lengthHeader);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`R2 HEAD failed for "${key}": invalid content-length`);
    }

    return {
      size,
      contentType: response.headers.get('content-type') ?? DEFAULT_CONTENT_TYPE,
      url: this.objectPublicUrl(key),
    };
  }

  async getObjectRange(key: string, start: number, endInclusive: number): Promise<Uint8Array> {
    if (start < 0 || endInclusive < start) {
      throw new Error(
        `getObjectRange: invalid range ${start}-${endInclusive} (start must be >= 0 and endInclusive >= start)`,
      );
    }

    const { url, headers } = signS3Request({
      method: 'GET',
      accountId: this.accountId,
      bucket: this.bucket,
      key,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: EMPTY_SHA256,
      extraHeaders: { range: `bytes=${start}-${endInclusive}` },
      now: new Date(),
    });

    const response = await fetch(url, { method: 'GET', headers });
    if (response.status === 404) {
      throw new Error(`R2 GET range failed for "${key}": NoSuchKey object not found`);
    }
    // 206 Partial Content is the expected success; some backends return 200
    // with the full object when range is unsupported — still accept it.
    if (!response.ok && response.status !== 206) {
      throw await storageError('GET range', key, response);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  async del(keyOrUrl: string): Promise<void> {
    const key = this.extractKey(keyOrUrl);
    const { url, headers } = signS3Request({
      method: 'DELETE',
      accountId: this.accountId,
      bucket: this.bucket,
      key,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: EMPTY_SHA256,
      now: new Date(),
    });

    // Best-effort: a missing key is not an error. S3/R2 returns 204 regardless;
    // tolerate 404 defensively.
    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok && response.status !== 404) {
      throw await storageError('DELETE', key, response);
    }
  }

  async list(opts?: ListOptions): Promise<ListResult> {
    const { url, headers } = signS3Request({
      method: 'GET',
      accountId: this.accountId,
      bucket: this.bucket,
      region: REGION,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: EMPTY_SHA256,
      query: {
        'list-type': '2',
        prefix: opts?.prefix,
        'max-keys': String(opts?.limit ?? DEFAULT_LIST_LIMIT),
        'continuation-token': opts?.cursor,
      },
      now: new Date(),
    });

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw await storageError('LIST', this.bucket, response);
    }

    const parsed = parseListObjectsV2(await response.text());
    const items: ListItem[] = parsed.objects.map((entry) => ({
      key: entry.key,
      url: this.objectPublicUrl(entry.key),
      size: entry.size,
      uploadedAt: entry.lastModified,
    }));

    return {
      items,
      cursor: parsed.nextContinuationToken,
      hasMore: parsed.isTruncated,
    };
  }

  private objectPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private extractKey(keyOrUrl: string): string {
    const parsed = tryParseUrl(keyOrUrl);
    if (!parsed) {
      return keyOrUrl;
    }
    // URL form — strip the leading slash from the pathname.
    return parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
  }
}

export function createR2Provider(config: R2Config): StorageProvider {
  return new R2Provider(config);
}

// ── helpers ────────────────────────────────────────────────────────────────

async function storageError(operation: string, key: string, response: Response): Promise<Error> {
  const body = await response.text().catch(() => '');
  const { code, message } = s3ErrorFields(body);
  return new Error(
    `R2 ${operation} failed for "${key}": ${code ?? response.status} ${message ?? response.statusText}`,
  );
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
