import config from '@revealui/config';
import type { RevealCollectionConfig } from '@revealui/core';
import type { Order } from '@revealui/core/types/admin';
import { isAdmin, isAdminOrLoggedIn } from '@/lib/access';
import { adminsOrOrderedBy } from './access/adminsOrOrderedBy';
import { clearUserCart } from './hooks/clearUserCart';
import { populateOrderedBy } from './hooks/populateOrderedBy';
import { updateUserPurchases } from './hooks/updateUserPurchases';

export const Orders: RevealCollectionConfig<Order> = {
  slug: 'orders',
  admin: {
    useAsTitle: 'createdAt',
    defaultColumns: ['createdAt', 'orderedBy'],
    preview: (doc: Record<string, unknown>) => `${config.reveal.publicServerURL}/orders/${doc.id}`,
  },
  hooks: {
    afterChange: [updateUserPurchases, clearUserCart],
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
        beforeChange: [populateOrderedBy],
      },
    },
    {
      name: 'stripePaymentIntentID',
      label: 'Stripe Payment Intent ID',
      type: 'text',
      admin: {
        position: 'sidebar',
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
};
