/**
 * @revealui/config - Storage Configuration Module
 */

import type { EnvConfig } from '../schema.js';

/**
 * Resolved Cloudflare R2 credentials. Present only when ALL five R2 env vars
 * are set; maps 1:1 to the `R2Config` consumed by `@revealui/core`'s storage
 * factory. `publicBaseUrl` is required by the R2 provider (no presigned-URL
 * fallback in GAP-208 Phase 2a/2b).
 */
export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export interface StorageConfig {
  /**
   * Cloudflare R2 config — the canonical (and sole) object-storage backend.
   * Populated only when all five `R2_*` env vars are set; otherwise `undefined`.
   * Partial R2 config intentionally resolves to `undefined` so build-time
   * lenient validation never throws; the consumer (`apps/server`
   * `getMediaStorage()` / `apps/admin` revealui.config `resolveProvider`) raises
   * a clear runtime error naming the missing vars when R2 does not resolve.
   * The legacy Vercel Blob fallback was removed in #1644.
   */
  r2: R2StorageConfig | undefined;
}

export function getStorageConfig(env: EnvConfig): StorageConfig {
  return {
    r2: resolveR2Config(env),
  };
}

/**
 * Returns the R2 config only when every required var is present. Returns
 * `undefined` for both the "no R2 configured" and "partially configured" cases
 * — keeping this function total (never throws) so it is safe to call during
 * build-time lenient validation.
 */
function resolveR2Config(env: EnvConfig): R2StorageConfig | undefined {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } =
    env;
  if (
    !(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_BASE_URL)
  ) {
    return undefined;
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL,
  };
}
