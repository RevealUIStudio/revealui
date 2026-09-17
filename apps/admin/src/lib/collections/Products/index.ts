import type { RevealCollectionConfig } from '@revealui/core';
import type { Product } from '@revealui/core/types/admin';
import { isAdmin } from '@/lib/access';
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
import { CallToAction } from '@/lib/blocks/CallToAction/config';
import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
import { populateArchiveBlock } from '@/lib/hooks';
import { checkUserPurchases } from './access/checkUserPurchases';
import { beforeProductChange } from './hooks/beforeChange';
import { deleteProductFromCarts } from './hooks/deleteProductFromCarts';
import { enrichProduct } from './hooks/enrichProduct';
import { revalidateProduct } from './hooks/revalidateProduct';

const Products: RevealCollectionConfig<Product> = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'stripeProductID', '_status'],
    preview: (doc: Record<string, unknown>) => {
      // Use the cookie-based JWT preview route  -  no secret in the URL
      // process.env (not import.meta.env) so the value is read at runtime, not inlined at build time
      const serverUrl = process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000';
      return `${serverUrl}/next/preview?path=${encodeURIComponent(`/products/${doc.slug}`)}`;
    },
  },
  hooks: {
    beforeChange: [beforeProductChange],
    afterChange: [revalidateProduct],
    afterRead: [enrichProduct, populateArchiveBlock],
    afterDelete: [deleteProductFromCarts],
  },
  versions: {
    drafts: true,
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'publishedOn',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
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
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
        {
          label: 'Product Details',
          fields: [
            {
              name: 'stripeProductID',
              label: 'Stripe Product',
              type: 'text',
              admin: {
                components: {},
              },
            },
            {
              name: 'priceJSON',
              label: 'Price JSON',
              type: 'textarea',
              admin: {
                readOnly: true,
                hidden: true,
                rows: 10,
              },
            },
            {
              name: 'enablePaywall',
              label: 'Enable Paywall',
              type: 'checkbox',
            },
            {
              name: 'paywall',
              label: 'Paywall',
              type: 'blocks',
              access: {
                read: checkUserPurchases as never,
              },
              blocks: [CallToAction /* Content */, MediaBlock, ArchiveBlock],
            },
          ],
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'relatedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      filterOptions: ({ id }) => {
        return {
          id: {
            not_in: id ? [id] : [],
          },
        };
      },
    },
    {
      name: 'skipSync',
      label: 'Skip Sync',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
        readOnly: true,
        hidden: true,
      },
    },
  ],
};

export default Products;
