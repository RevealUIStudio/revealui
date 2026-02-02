'use server'

/**
 * Vercel Blob Storage Plugin
 *
 * WARNING: This module is server-only.
 * Do NOT import in client-side code or edge runtime.
 */

import { del, put } from '@vercel/blob'
import { defaultLogger } from '../instance/logger.js'
import type { Plugin } from '../types/index.js'

export interface VercelBlobStorageConfig {
  enabled?: boolean
  collections?: {
    [key: string]: boolean
  }
  token?: string
  prefix?: string
}

export function vercelBlobStorage(config: VercelBlobStorageConfig): Plugin {
  const prefix = config.prefix || 'uploads'

  return (incomingConfig) => {
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
                name: 'vercel-blob',
                adapter: {
                  name: 'vercel-blob',
                  generateURL: (file: { filename: string }) => {
                    return `${prefix}/${file.filename}`
                  },
                  upload: async (file: {
                    name: string
                    data: Buffer
                    size: number
                    mimetype: string
                    width?: number
                    height?: number
                  }) => {
                    try {
                      const filePath = `${prefix}/${collection.slug}/${Date.now()}-${file.name}`
                      if (!config.token) {
                        throw new Error('Vercel blob token is required but not configured')
                      }

                      const blob = await put(filePath, file.data, {
                        access: 'public',
                        token: config.token,
                        addRandomSuffix: false,
                      })

                      return {
                        url: blob.url,
                        filename: file.name,
                        filesize: file.size,
                        mimeType: file.mimetype,
                        width: file.width,
                        height: file.height,
                      }
                    } catch (error) {
                      defaultLogger.error('Vercel Blob upload error:', error)
                      throw error
                    }
                  },
                  delete: async (filename: string) => {
                    try {
                      // Extract the blob URL from filename or construct it
                      const blobUrl = filename.startsWith('http')
                        ? filename
                        : `${prefix}/${filename}`

                      await del(blobUrl)
                    } catch (error) {
                      defaultLogger.error('Vercel Blob delete error:', error)
                      throw error
                    }
                  },
                  generateFileURL: (file: { filename: string }) => {
                    return `${prefix}/${collection.slug}/${file.filename}`
                  },
                },
              },
            ],
          }

          collection.upload = uploadConfig
        }
      }
    }

    return incomingConfig
  }
}
