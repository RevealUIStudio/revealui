/**
 * Prices Collection
 *
 * Stripe-backed pricing with content management capabilities.
 * Supports automatic relationship population via the RevealUI Populate API.
 *
 * @example Query with populated relationships
 * ```typescript
 * // Fetch price with categories and related prices populated
 * const price = await revealui.findByID({
 *   collection: 'prices',
 *   id: priceId,
 *   depth: 1, // Populate direct relationships
 * })
 *
 * // Manually populate after fetching
 * const prices = await revealui.find({ collection: 'prices' })
 * const populated = await revealui.populate('prices', prices.docs, { depth: 1 })
 * ```
 */

import type { RevealCollectionConfig } from '@revealui/core';
import type { Price } from '@revealui/core/types/cms';
import { isAdmin } from '@/lib/access';
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
import { CallToAction } from '@/lib/blocks/CallToAction/config';
import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
import { populateArchiveBlock } from '@/lib/hooks';
import { checkUserPurchases } from './access/checkUserPurchases';
import { beforePriceChange } from './hooks/beforeChange';
import { calculatePrice } from './hooks/calculatePrice';
import { deletePriceFromCarts } from './hooks/deletePriceFromCarts';
import { revalidatePrice } from './hooks/revalidatePrice';

const Prices: RevealCollectionConfig<Price> = {
  slug: 'prices',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'stripePriceID', '_status'],
    preview: (doc: Record<string, unknown>) => {
      return `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/api/preview?url=${encodeURIComponent(
        `${import.meta.env.REVEALUI_PUBLIC_SERVER_URL}/prices/${doc.slug}`,
      )}&secret=${import.meta.env.REVEALUI_DRAFT_SECRET}`;
    },
  },
  hooks: {
    beforeChange: [beforePriceChange],
    afterChange: [revalidatePrice],
    afterRead: [populateArchiveBlock, calculatePrice],
    afterDelete: [deletePriceFromCarts],
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
          label: 'Price Details',
          fields: [
            {
              name: 'stripePriceID',
              label: 'Stripe Price',
              type: 'text',
              admin: {
                components: {
                  Field: '@/lib/collections/Prices/ui/PricesSelect',
                },
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
      // Populate categories by default for better UX
      // Use depth: 1 to get category names
    },
    {
      name: 'relatedPrices',
      type: 'relationship',
      relationTo: 'prices',
      hasMany: true,
      maxDepth: 1, // Prevent deep nesting of related prices
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

export default Prices;
