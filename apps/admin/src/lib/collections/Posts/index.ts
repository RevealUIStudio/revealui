import type { RevealCollectionConfig } from '@revealui/core';
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@revealui/core/richtext';
import type { Post } from '@revealui/core/types/admin';
import { authenticated } from '@/lib/access';
import { authenticatedOrPublished } from '@/lib/access/roles/authenticatedOrPublished';
import { Banner } from '@/lib/blocks/Banner/config';
import { Code } from '@/lib/blocks/Code/config';
import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
import { slugField } from '@/lib/fields/slug';
import { generatePreviewPath } from '@/lib/utilities/generatePreviewPath';
import { indexPost } from './hooks/indexPost';
import { populateAuthors } from './hooks/populateAuthors';
import { revalidatePost } from './hooks/revalidatePost';

export const Posts: RevealCollectionConfig<Post> = {
  slug: 'posts',
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
          path: `/posts/${typeof data?.slug === 'string' ? data.slug : ''}`,
        });
        return `${process.env.NEXT_PUBLIC_SERVER_URL}${path}`;
      },
    },
    preview: (doc: Record<string, unknown>) =>
      generatePreviewPath({
        path: `/posts/${typeof doc?.slug === 'string' ? doc.slug : ''}`,
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
          label: 'Content',
          fields: [
            {
              name: 'content',
              type: 'richText',
              editor: lexicalEditor({
                features: ({ rootFeatures }) => [
                  ...rootFeatures,
                  HeadingFeature({
                    enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'],
                  }),
                  BlocksFeature({ blocks: [Banner, Code, MediaBlock] }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                  HorizontalRuleFeature(),
                ],
              }),
              label: false,
              required: true,
            },
          ],
        },
        {
          label: 'Meta',
          fields: [
            {
              name: 'relatedPosts',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              filterOptions: ({ id }) => ({
                id: {
                  not_in: id ? [id] : [],
                },
              }),
              hasMany: true,
              relationTo: 'posts',
            },
            {
              name: 'categories',
              type: 'relationship',
              admin: {
                position: 'sidebar',
              },
              hasMany: true,
              relationTo: 'categories',
            },
          ],
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
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }: { siblingData?: { _status?: string }; value: unknown }) => {
            if (siblingData?._status === 'published' && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
    {
      name: 'authors',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'users',
    },
    {
      name: 'populatedAuthors',
      type: 'array',
      access: {
        update: () => false,
      },
      admin: {
        disabled: true,
        readOnly: true,
      },
      fields: [
        {
          name: 'id',
          type: 'text',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
    },
    ...slugField(),
  ],
  hooks: {
    afterChange: [revalidatePost, indexPost],
    afterRead: [populateAuthors],
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
