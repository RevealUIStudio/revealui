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
 * GAP-208 introduces this abstraction during the Vercel Blob → Cloudflare R2
 * swap (2026-05-18). The vercel-blob Payload-style plugin (vercel-blob.ts)
 * stays in place during migration for backward compat; once consumers migrate
 * to the interface, the legacy plugin is dropped.
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

  /** Provider tag (e.g. "r2", "vercel-blob", "mock") — exposed so consumers can adapt URL handling. */
  readonly provider: string;
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
export type StorageConfig =
  | { provider: 'r2'; r2: R2Config }
  | { provider: 'vercel-blob'; vercelBlob: VercelBlobConfig }
  | { provider: 'mock' };

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
   * Optional public base URL for objects (e.g. "https://media.revealui.com" if a
   * custom domain is bound, or "https://<account-id>.r2.cloudflarestorage.com/<bucket>"
   * for the dev URL). When set, PutResult.url uses this base. When omitted, PutResult.url
   * falls back to a presigned URL (private bucket pattern).
   */
  publicBaseUrl?: string;
}

export interface VercelBlobConfig {
  /** vercel_blob_rw_* token from the Vercel Blob dashboard. */
  token: string;
}
