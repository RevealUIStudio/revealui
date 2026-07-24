/**
 * Object-storage upload plugin (provider-agnostic).
 *
 * Adapts any `StorageProvider` (Cloudflare R2 — canonical — mock, or a future
 * backend) to the RevealUI engine's collection upload-adapter interface, so
 * `apps/admin/revealui.config.ts` stores media through the configured
 * object-storage backend. Replaces the provider-specific `vercelBlobStorage`
 * Payload plugin retired in GAP-208 Phase 4.
 *
 * The backend is resolved through a lazy `resolveProvider` thunk — invoked
 * (and memoized) on the first upload/delete, never at config-build time — so a
 * consumer reading validated config (e.g. `@revealui/config`'s `config.storage`)
 * does NOT force env validation when the admin config module is imported during
 * `next build`, tests, or boot. This mirrors `apps/server` `getMediaStorage()`,
 * which reads `config.storage` lazily per request.
 *
 * WARNING: This module is server-only.
 * Do NOT import in client-side code or edge runtime.
 */

import { logger } from '../observability/logger.js';
import type { Plugin } from '../types/index.js';
import type { StorageProvider } from './types.js';

export interface ObjectStorageConfig {
  /** When `false`, the plugin is a no-op (no upload config applied). Defaults to enabled. */
  enabled?: boolean;
  /** Map of collection slug → whether to attach upload handling. */
  collections?: {
    [key: string]: boolean;
  };
  /**
   * Lazily resolves the backend the upload adapter writes through. Called once
   * (memoized) on the first upload/delete — never at config build — so reading
   * validated config (e.g. `@revealui/config`'s `config.storage`) does not force
   * env validation at module load. Should throw a clear, actionable error when
   * no backend is configured (fail-fast; never silently no-op an upload).
   */
  resolveProvider: () => StorageProvider;
  /** Key prefix for stored objects. Defaults to `'uploads'`. */
  prefix?: string;
}

export function objectStorage(config: ObjectStorageConfig): Plugin {
  const prefix = config.prefix || 'uploads';

  // Memoize the provider so the underlying client (S3 / Blob) is constructed
  // once per process, not per upload — and so config is read lazily, on first
  // use, rather than at config-build time.
  let cachedProvider: StorageProvider | undefined;
  const getProvider = (): StorageProvider => {
    if (!cachedProvider) {
      cachedProvider = config.resolveProvider();
    }
    return cachedProvider;
  };

  return (incomingConfig) => {
    if (config.enabled === false) {
      return incomingConfig;
    }

    // Add storage functionality to collections
    if (incomingConfig.collections) {
      for (const collection of incomingConfig.collections) {
        if (config.collections?.[collection.slug]) {
          // Generate upload config
          const uploadConfig: Record<string, unknown> = {
            staticURL: '/api/media',
            staticDir: 'media',
            mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
            adminThumbnail: 'thumbnail',
            focalPoint: true,
            crop: true,
            adapters: [
              {
                name: 'object-storage',
                adapter: {
                  name: 'object-storage',
                  generateURL: (file: { filename: string }) => {
                    return `${prefix}/${file.filename}`;
                  },
                  upload: async (file: {
                    name: string;
                    data: Buffer;
                    size: number;
                    mimetype: string;
                    width?: number;
                    height?: number;
                  }) => {
                    try {
                      const key = `${prefix}/${collection.slug}/${Date.now()}-${file.name}`;
                      const result = await getProvider().put(key, file.data, {
                        access: 'public',
                        contentType: file.mimetype,
                      });

                      return {
                        url: result.url,
                        filename: file.name,
                        filesize: file.size,
                        mimeType: file.mimetype,
                        width: file.width,
                        height: file.height,
                      };
                    } catch (error) {
                      logger.error(
                        'Object storage upload error',
                        error instanceof Error ? error : new Error(String(error)),
                      );
                      throw error;
                    }
                  },
                  delete: async (filename: string) => {
                    try {
                      // Payload may pass a full URL (preferred — providers extract
                      // the storage key from it) or a bare filename; mirror the
                      // legacy plugin's prefix-prepend for the bare-filename case.
                      const keyOrUrl = filename.startsWith('http')
                        ? filename
                        : `${prefix}/${filename}`;

                      await getProvider().del(keyOrUrl);
                    } catch (error) {
                      logger.error(
                        'Object storage delete error',
                        error instanceof Error ? error : new Error(String(error)),
                      );
                      throw error;
                    }
                  },
                  generateFileURL: (file: { filename: string }) => {
                    return `${prefix}/${collection.slug}/${file.filename}`;
                  },
                },
              },
            ],
          };

          collection.upload = uploadConfig;
        }
      }
    }

    return incomingConfig;
  };
}
