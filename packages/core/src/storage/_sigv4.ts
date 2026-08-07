/**
 * AWS Signature Version 4 signer for the Cloudflare R2 (S3-compatible) API.
 *
 * Replaces the request signing that @aws-sdk/client-s3 used to do for us.
 * Uses only node:crypto — no external dependencies, no regex.
 *
 * The core (`computeSigV4`) is verified byte-for-byte against the official AWS
 * SigV4 test-suite `get-vanilla` vector in __tests__/_sigv4.test.ts.
 *
 * Server-only. Do NOT import from client-side code or edge runtime.
 */

import { createHash, createHmac } from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const S3_SERVICE = 's3';

/** Hex SHA-256 of the empty string — the payload hash for body-less requests. */
export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** Hex SHA-256 of arbitrary bytes (request payload hashing). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~';

/**
 * RFC 3986 percent-encoding per the AWS SigV4 spec. `encodeSlash` is false for
 * path segments (slashes are separators) and true for query keys/values.
 */
export function awsUriEncode(input: string, encodeSlash: boolean): string {
  let out = '';
  for (const byte of new TextEncoder().encode(input)) {
    const ch = String.fromCharCode(byte);
    if (UNRESERVED.includes(ch)) {
      out += ch;
    } else if (ch === '/' && !encodeSlash) {
      out += '/';
    } else {
      out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}

function toAmzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString(); // e.g. 2026-05-18T10:00:00.000Z
  const amzDate = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/** Inputs to the verified SigV4 core. All path/header values must be final. */
export interface CanonicalInput {
  method: string;
  /** Already AWS-URI-encoded path (slashes preserved). */
  canonicalPath: string;
  /** Raw (unencoded) query pairs; encoded + sorted by the signer. */
  query: [string, string][];
  /** Exact header set to sign (any case; lowercased + trimmed internally). */
  headersToSign: Record<string, string>;
  payloadHash: string;
  amzDate: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SigV4Result {
  signature: string;
  signedHeaders: string;
  scope: string;
  canonicalQuery: string;
}

/**
 * The verified SigV4 computation: canonical request → string-to-sign → signing
 * key → signature. Verified against AWS's official `get-vanilla` test vector.
 */
export function computeSigV4(input: CanonicalInput): SigV4Result {
  const lowered = new Map<string, string>();
  for (const [name, value] of Object.entries(input.headersToSign)) {
    lowered.set(name.toLowerCase(), value.trim());
  }
  const names = [...lowered.keys()].sort();
  const canonicalHeaders = names.map((n) => `${n}:${lowered.get(n)}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalQuery = [...input.query]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${awsUriEncode(k, true)}=${awsUriEncode(v, true)}`)
    .join('&');

  const canonicalRequest = [
    input.method,
    input.canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');

  const dateStamp = input.amzDate.slice(0, 8);
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [ALGORITHM, input.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return { signature, signedHeaders, scope, canonicalQuery };
}

/** Payload hash token for presigned URLs (body hash unknown at sign time). */
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

/** Inputs for an R2/S3 request signature. */
export interface SignS3Input {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  accountId: string;
  bucket: string;
  /** Object key; omit for bucket-level operations (e.g. ListObjectsV2). */
  key?: string;
  /** Query params; `undefined` values are dropped before signing. */
  query?: Record<string, string | undefined>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Hex SHA-256 of the body, or EMPTY_SHA256 for body-less requests. */
  payloadHash: string;
  /** Extra headers to send + sign (content-type, cache-control, x-amz-meta-*). */
  extraHeaders?: Record<string, string>;
  now: Date;
}

export interface SignedS3Request {
  url: string;
  headers: Record<string, string>;
}

/**
 * Build a signed R2 request: a path-style URL + AWS4-HMAC-SHA256 Authorization
 * header. The `host` header is signed but not returned — fetch/undici sets it
 * from the URL (same value), and `Host` is a forbidden header to set manually.
 */
export function signS3Request(input: SignS3Input): SignedS3Request {
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const { amzDate } = toAmzDate(input.now);

  const encodedKey = (input.key ?? '')
    .split('/')
    .map((segment) => awsUriEncode(segment, false))
    .join('/');
  const canonicalPath =
    input.key !== undefined
      ? `/${awsUriEncode(input.bucket, false)}/${encodedKey}`
      : `/${awsUriEncode(input.bucket, false)}`;

  const query: [string, string][] = [];
  for (const [k, v] of Object.entries(input.query ?? {})) {
    if (v !== undefined) query.push([k, v]);
  }

  const headersToSign: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': input.payloadHash,
  };
  for (const [k, v] of Object.entries(input.extraHeaders ?? {})) {
    headersToSign[k.toLowerCase()] = v;
  }

  const { signature, signedHeaders, scope, canonicalQuery } = computeSigV4({
    method: input.method,
    canonicalPath,
    query,
    headersToSign,
    payloadHash: input.payloadHash,
    amzDate,
    region: input.region,
    service: S3_SERVICE,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });

  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': input.payloadHash,
    authorization: `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  for (const [k, v] of Object.entries(input.extraHeaders ?? {})) {
    headers[k.toLowerCase()] = v;
  }

  const url = `https://${host}${canonicalPath}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  return { url, headers };
}

/** Inputs for a query-string presigned S3/R2 URL (no Authorization header). */
export interface SignS3PresignedInput {
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  accountId: string;
  bucket: string;
  key: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Lifetime of the URL in seconds. */
  expiresInSeconds: number;
  /**
   * Headers the client must send and that are included in the signature
   * (content-type, content-length, …). Host is always signed and omitted
   * from the returned headers (fetch sets it from the URL).
   */
  signedHeaders?: Record<string, string>;
  now: Date;
}

export interface PresignedS3Url {
  url: string;
  /** Headers the client must include (signed set minus host). */
  headers: Record<string, string>;
}

/**
 * Build a query-string SigV4 presigned URL for R2/S3.
 *
 * Uses UNSIGNED-PAYLOAD so the client does not need to pre-hash the body.
 * Credential and signature ride in the query string; the client sends only
 * the signed non-host headers (e.g. content-type) with the request.
 */
export function signS3PresignedUrl(input: SignS3PresignedInput): PresignedS3Url {
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const { amzDate, dateStamp } = toAmzDate(input.now);
  const scope = `${dateStamp}/${input.region}/${S3_SERVICE}/aws4_request`;

  const encodedKey = input.key
    .split('/')
    .map((segment) => awsUriEncode(segment, false))
    .join('/');
  const canonicalPath = `/${awsUriEncode(input.bucket, false)}/${encodedKey}`;

  const clientHeaders: Record<string, string> = {};
  const headersToSign: Record<string, string> = { host };
  for (const [name, value] of Object.entries(input.signedHeaders ?? {})) {
    const lower = name.toLowerCase();
    if (lower === 'host') continue;
    headersToSign[lower] = value;
    clientHeaders[lower] = value;
  }

  const signedHeaderNames = Object.keys(headersToSign).sort().join(';');

  const query: [string, string][] = [
    ['X-Amz-Algorithm', ALGORITHM],
    ['X-Amz-Credential', `${input.accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(input.expiresInSeconds)],
    ['X-Amz-SignedHeaders', signedHeaderNames],
  ];

  const { signature, canonicalQuery } = computeSigV4({
    method: input.method,
    canonicalPath,
    query,
    headersToSign,
    payloadHash: UNSIGNED_PAYLOAD,
    amzDate,
    region: input.region,
    service: S3_SERVICE,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });

  const fullQuery = `${canonicalQuery}&${awsUriEncode('X-Amz-Signature', true)}=${awsUriEncode(signature, true)}`;
  return {
    url: `https://${host}${canonicalPath}?${fullQuery}`,
    headers: clientHeaders,
  };
}
