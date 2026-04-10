import type { RevealCollectionConfig } from '@revealui/core';
import type { Page } from '@revealui/core/types/admin';
import { authenticated } from '@/lib/access';
import { authenticatedOrPublished } from '@/lib/access/roles/authenticatedOrPublished';
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
import { Banner } from '@/lib/blocks/Banner/config';
import { CallToAction } from '@/lib/blocks/CallToAction/config';
import { Code } from '@/lib/blocks/Code/config';
import { Content } from '@/lib/blocks/Content/config';
import { FormBlock } from '@/lib/blocks/Form/config';
import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
import { slugField } from '@/lib/fields/slug/index';
import { hero } from '@/lib/heros/config';
import { populatePublishedAt } from '@/lib/hooks/populatePublishedAt';
import { generatePreviewPath } from '@/lib/utilities/generatePreviewPath';
import { indexPage } from './hooks/indexPage';
import { revalidatePage } from './hooks/revalidatePage';
export const Pages: RevealCollectionConfig<Page> = {
  slug: 'pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data }: { data: Record<string, unknown> }) => {
        const path = generatePreviewPath({
          path: `/${typeof data?.slug === 'string' ? data.slug : ''}`,
        });
        return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
      },
    },
    preview: (doc: Record<string, unknown>) =>
      generatePreviewPath({
        path: `/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, ArchiveBlock, FormBlock, Code, Banner],
              required: true,
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            {
              name: 'image',
              type: 'relationship',
              relationTo: 'media',
            },
            {
              name: 'title',
              type: 'text',
            },
            {
              name: 'description',
              type: 'textarea',
            },
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    ...slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage, indexPage],
    beforeChange: [populatePublishedAt],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100,
      },
    },
    maxPerDoc: 50,
  },
};
