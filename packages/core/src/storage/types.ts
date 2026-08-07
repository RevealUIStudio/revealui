/**
 * Provider-agnostic storage interface for the RevealUI fleet.
 *
 * Per `feedback_revealui_agnosticism_principle` + `feedback_pluggable_provider_pattern`:
 * slim interface, tag + factory, explicit "no-X" opt-in, mock provider for tests.
 *
 * Providers implement this interface; consumers (apps/server media routes,
 * apps/admin health probes, packages/core Payload-style plugin shims) depend
 * only on this contract. Switching providers becomes a config change.
 *
 * GAP-208 introduced this abstraction during the Vercel Blob → Cloudflare R2
 * swap (2026-05-18). #1644 removed the Vercel Blob StorageProvider once R2 was
 * confirmed in every production environment; Cloudflare R2 is now the sole
 * non-mock backend.
 */

// ── Provider contract ────────────────────────────────────────────────────────

export interface StorageProvider {
  /** Upload binary data. Returns a fully-qualified URL the value is reachable at. */
  put(
    key: string,
    data: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    opts?: PutOptions,
  ): Promise<PutResult>;

  /** Delete by either provider URL or storage key. Best-effort; missing keys are not errors. */
  del(keyOrUrl: string): Promise<void>;

  /** List items, optionally filtered by key prefix. Used by health probes + admin browsing. */
  list(opts?: ListOptions): Promise<ListResult>;

  /**
   * Issue a short-lived presigned PUT URL so clients upload bytes direct to the
   * backend (GAP-215 / Phase 2b). File bytes never buffer in the API function.
   */
  createPresignedPutUrl(opts: PresignPutOptions): Promise<PresignPutResult>;

  /**
   * HEAD an object. Used by the media confirm endpoint to re-check size and
   * content-type after a direct-to-storage upload.
   */
  headObject(key: string): Promise<HeadObjectResult>;

  /**
   * GET a byte range of an object (inclusive end). Used to re-check magic
   * bytes on confirm without downloading the whole file.
   */
  getObjectRange(key: string, start: number, endInclusive: number): Promise<Uint8Array>;

  /** Provider tag (e.g. "r2", "mock") — exposed so consumers can adapt URL handling. */
  readonly provider: string;
}

// ── Presigned PUT (Phase 2b / GAP-215) ───────────────────────────────────────

export interface PresignPutOptions {
  /** Storage key the client will write (provider-relative, e.g. "media/uuid.jpg"). */
  key: string;

  /** MIME type the client must send as Content-Type (signed into the URL). */
  contentType: string;

  /**
   * Optional declared Content-Length. When set, signed into the request so the
   * client cannot upload a larger body. Browser fetch cannot set Content-Length
   * manually, so media direct-upload leaves this unset and re-checks size via
   * headObject on confirm.
   */
  contentLength?: number;

  /** URL lifetime in seconds. Defaults to provider-specific value (typically 900). */
  expiresInSeconds?: number;
}

export interface PresignPutResult {
  /** Fully-qualified presigned PUT URL (query-string SigV4). */
  url: string;

  /**
   * Headers the client MUST send with the PUT (at least content-type). Values
   * are already signed into the URL's X-Amz-SignedHeaders set.
   */
  headers: Record<string, string>;

  /** Storage key the URL writes to (echo of PresignPutOptions.key). */
  key: string;

  /** Absolute expiry of the URL. */
  expiresAt: Date;
}

// ── HEAD / range GET ─────────────────────────────────────────────────────────

export interface HeadObjectResult {
  size: number;
  contentType: string;
  /** Public (or mock) URL the object is reachable at for GET. */
  url: string;
}

// ── Put ──────────────────────────────────────────────────────────────────────

export interface PutOptions {
  /** MIME type — written to the object's Content-Type header. Defaults to "application/octet-stream". */
  contentType?: string;

  /**
   * Public read access (no auth required for GET on the returned URL).
   * Defaults to "public" because the current media-upload flow needs public CDN URLs.
   * Providers that don't support public access (e.g. private-bucket-only configs)
   * MUST throw when access: "public" is requested.
   */
  access?: 'public' | 'private';

  /** Cache-Control header value. Provider may apply a sensible default if omitted. */
  cacheControl?: string;

  /** Custom user-metadata. Keys are lowercased; values are strings. Limits vary by provider. */
  metadata?: Record<string, string>;
}

export interface PutResult {
  /** The storage key the object was written to (provider-relative, e.g. "media/uuid.jpg"). */
  key: string;

  /** Fully-qualified URL the object is reachable at for GET. */
  url: string;

  /** Storage size in bytes. Always populated by every provider. */
  size: number;

  /** Provider tag that wrote this object (matches StorageProvider.provider). */
  provider: string;
}

// ── List ─────────────────────────────────────────────────────────────────────

export interface ListOptions {
  /** Filter to keys starting with this prefix. */
  prefix?: string;

  /** Maximum items per page. Providers cap this internally (typically 1000). */
  limit?: number;

  /** Opaque pagination cursor from a previous ListResult. */
  cursor?: string;
}

export interface ListResult {
  items: ListItem[];

  /** Next-page cursor if hasMore is true; undefined when listing is exhausted. */
  cursor?: string;

  hasMore: boolean;
}

export interface ListItem {
  key: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

// ── Factory config (tagged union) ────────────────────────────────────────────

/**
 * Discriminated union over `provider`. Adding a new provider means:
 *   1. add a tag here + the per-provider config shape
 *   2. add a case in the createStorage factory
 *   3. implement the StorageProvider interface in a new file
 *
 * No silent fallback per `feedback_pluggable_provider_pattern`: unknown tags
 * throw with a clear "valid tags: ..." message.
 */
export type StorageConfig = { provider: 'r2'; r2: R2Config } | { provider: 'mock' };

export interface R2Config {
  /** Cloudflare account ID (visible at top of the R2 dashboard). */
  accountId: string;

  /** R2 API token Access Key ID (NOT the global account API token). */
  accessKeyId: string;

  /** R2 API token Secret Access Key (paired with accessKeyId). */
  secretAccessKey: string;

  /** Bucket name (per-account-globally-unique within R2). */
  bucket: string;

  /**
   * Public base URL for objects (e.g. "https://media.revealui.com" if a custom
   * domain is bound, or the R2 dev URL). Required: PutResult.url, HeadObjectResult.url,
   * and media rows after confirm use this base. Presigned PUT URLs themselves
   * target the S3 API endpoint and do not need this, but the final public media
   * URL still does.
   */
  publicBaseUrl?: string;
}
