import { put, del, list, head } from '@vercel/blob';
import type { Plugin, UploadConfig, Document } from '../types/index';
import path from 'path';

export interface VercelBlobStorageConfig {
  enabled?: boolean;
  collections?: {
    [key: string]: boolean;
  };
  token?: string;
  prefix?: string;
}

export function vercelBlobStorage(config: VercelBlobStorageConfig): Plugin {
  const prefix = config.prefix || 'uploads';

  return (incomingConfig) => {
    // Add storage functionality to collections
    if (incomingConfig.collections) {
      for (const collection of incomingConfig.collections) {
        if (config.collections?.[collection.slug]) {
          // Generate upload config
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uploadConfig: any = {
            staticURL: '/api/media',
            staticDir: 'media',
            mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
            adminThumbnail: 'thumbnail',
            focalPoint: true,
            crop: true,
            adapters: [{
              name: 'vercel-blob',
              adapter: {
                name: 'vercel-blob',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                generateURL: (file: any) => {
                  return `${prefix}/${file.filename}`;
                },
                upload: async (file: { name: string; data: Buffer; size: number; mimetype: string; width?: number; height?: number }) => {
                  try {
                    const filePath = `${prefix}/${collection.slug}/${Date.now()}-${file.name}`;
                    const blob = await put(filePath, file.data, {
                      access: 'public',
                      token: config.token,
                      addRandomSuffix: false,
                    });

                    return {
                      url: blob.url,
                      filename: file.name,
                      filesize: file.size,
                      mimeType: file.mimetype,
                      width: file.width,
                      height: file.height,
                    };
                  } catch (error) {
                    console.error('Vercel Blob upload error:', error);
                    throw error;
                  }
                },
                delete: async (filename: string) => {
                  try {
                    // Extract the blob URL from filename or construct it
                    const blobUrl = filename.startsWith('http')
                      ? filename
                      : `${prefix}/${filename}`;

                    await del(blobUrl);
                  } catch (error) {
                    console.error('Vercel Blob delete error:', error);
                    throw error;
                  }
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                generateFileURL: (file: any) => {
                  return `${prefix}/${collection.slug}/${file.filename}`;
                },
              }
            }]
          };

          collection.upload = uploadConfig;
        }
      }
    }

    return incomingConfig;
  };
}

