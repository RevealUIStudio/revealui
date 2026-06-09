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
 *
 * Server-only. Do NOT import from client-side code or edge runtime.
 *
 * Known limitation (unchanged from the SDK version): request bodies are
 * buffered fully in memory (see toUint8Array) so the payload can be hashed for
 * SigV4. Streaming uploads (STREAMING-AWS4-HMAC-SHA256-PAYLOAD) are a future
 * enhancement; presigned/private URLs remain Phase 2b.
 */

import { toUint8Array } from './_helpers.js';
import { EMPTY_SHA256, sha256Hex, signS3Request } from './_sigv4.js';
import { parseListObjectsV2, s3ErrorFields } from './_xml.js';
import type {
  ListItem,
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  R2Config,
  StorageProvider,
} from './types.js';

const PROVIDER_TAG = 'r2';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const DEFAULT_LIST_LIMIT = 1000;
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
        'R2 provider requires R2Config.publicBaseUrl. Presigned/private URLs ' +
          'are not supported in Phase 2a. Set publicBaseUrl to either a bound ' +
          "custom domain (e.g. 'https://media.revealui.com') or the R2 dev URL " +
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
        "R2 provider Phase 2a does not support access: 'private'. All objects " +
          'are written under the publicBaseUrl. Presigned/private-URL support ' +
          'lands in Phase 2b.',
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

    const response = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'content-length': String(body.byteLength) },
      // `as BodyInit`: bridge the TS lib's ArrayBufferLike/ArrayBuffer typed-array
      // variance for fetch bodies — same pattern as src/api/compression.ts.
      body: body as BodyInit,
    });
    if (!response.ok) {
      throw await storageError('PUT', key, response);
    }

    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
      size: body.byteLength,
      provider: PROVIDER_TAG,
    };
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
      url: `${this.publicBaseUrl}/${entry.key}`,
      size: entry.size,
      uploadedAt: entry.lastModified,
    }));

    return {
      items,
      cursor: parsed.nextContinuationToken,
      hasMore: parsed.isTruncated,
    };
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
