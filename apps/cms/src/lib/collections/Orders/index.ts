import type { CollectionConfig } from '@revealui/core'
import { isAdmin, isAdminOrLoggedIn } from '@/lib/access'
import { adminsOrOrderedBy } from './access/adminsOrOrderedBy'
import { clearUserCart } from './hooks/clearUserCart'
import { populateOrderedBy } from './hooks/populateOrderedBy'
import { updateUserPurchases } from './hooks/updateUserPurchases'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'createdAt',
    defaultColumns: ['createdAt', 'orderedBy'],
    preview: (doc: Record<string, unknown>) =>
      `${process.env.REVEALUI_PUBLIC_SERVER_URL}/orders/${doc.id}`,
  },
  hooks: {
    // RevealUI CMS hook type compatibility - types don't exactly match but are runtime-compatible
    afterChange: [
      updateUserPurchases as unknown as NonNullable<CollectionConfig['hooks']>['afterChange'][0],
      clearUserCart as unknown as NonNullable<CollectionConfig['hooks']>['afterChange'][0],
    ],
  },
  access: {
    read: adminsOrOrderedBy,
    update: isAdmin,
    create: isAdminOrLoggedIn,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'orderedBy',
      type: 'relationship',
      relationTo: 'users',
      hooks: {
        // RevealUI CMS hook type compatibility - field hook types don't exactly match but are runtime-compatible
        beforeChange: [populateOrderedBy as unknown as NonNullable<NonNullable<CollectionConfig['fields']>[0]['hooks']>['beforeChange'][0]],
      },
    },
    {
      name: 'stripePaymentIntentID',
      label: 'Stripe Payment Intent ID',
      type: 'text',
      admin: {
        position: 'sidebar',
        components: {
          // biome-ignore lint/style/useNamingConvention: admin component keys use Field in RevealUI CMS.
          Field: '/src/lib/collections/Orders/ui/LinkToPaymentIntent',
        },
      },
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'price',
          type: 'number',
          min: 0,
        },
        {
          name: 'quantity',
          type: 'number',
          min: 0,
        },
      ],
    },
  ],
}
