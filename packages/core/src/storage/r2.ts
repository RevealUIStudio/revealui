/**
 * Cloudflare R2 implementation of StorageProvider.
 *
 * R2 is S3-compatible — uses @aws-sdk/client-s3 with a custom endpoint and
 * region='auto'. See https://developers.cloudflare.com/r2/api/s3/api/.
 *
 * GAP-208 Phase 2a (2026-05-18). Phase 1 (interface + types) shipped in #959.
 *
 * Server-only. Do NOT import from client-side code or edge runtime.
 */

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { toUint8Array } from './_helpers.js';
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

class R2Provider implements StorageProvider {
  readonly provider = PROVIDER_TAG;
  private readonly client: S3Client;
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

    this.bucket = config.bucket;
    this.publicBaseUrl = stripTrailingSlash(config.publicBaseUrl);
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts?.contentType ?? DEFAULT_CONTENT_TYPE,
        ContentLength: body.byteLength,
        CacheControl: opts?.cacheControl,
        Metadata: opts?.metadata,
      }),
    );

    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
      size: body.byteLength,
      provider: PROVIDER_TAG,
    };
  }

  async del(keyOrUrl: string): Promise<void> {
    const key = this.extractKey(keyOrUrl);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async list(opts?: ListOptions): Promise<ListResult> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: opts?.prefix,
        MaxKeys: opts?.limit ?? DEFAULT_LIST_LIMIT,
        ContinuationToken: opts?.cursor,
      }),
    );

    const items: ListItem[] = (response.Contents ?? []).flatMap((entry) => {
      if (!entry.Key) return [];
      return [
        {
          key: entry.Key,
          url: `${this.publicBaseUrl}/${entry.Key}`,
          size: entry.Size ?? 0,
          uploadedAt: entry.LastModified ?? new Date(0),
        },
      ];
    });

    return {
      items,
      cursor: response.NextContinuationToken,
      hasMore: response.IsTruncated === true,
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
