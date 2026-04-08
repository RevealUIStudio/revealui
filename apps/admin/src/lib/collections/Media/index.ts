import type { CollectionConfig } from '@revealui/core';
import { FixedToolbarFeature, InlineToolbarFeature, lexicalEditor } from '@revealui/core/richtext';
import { authenticated } from '@/lib/access';

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()];
        },
      }),
    },
  ],
  // Upload config is applied by the vercelBlobStorage plugin in revealui.config.ts.
  // Originals are stored in Vercel Blob; on-demand resizing is handled by next/image
  // (Vercel Image Optimization) — no pre-generated size variants needed.
  upload: {
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  },
};
