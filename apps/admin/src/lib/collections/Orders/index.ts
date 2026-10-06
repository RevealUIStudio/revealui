import config from '@revealui/config';
import type { RevealCollectionConfig } from '@revealui/core';
import { ORDER_STATUSES } from '@revealui/db/schema/products';
import { isAdmin } from '@/lib/access';
import { adminsOrCustomer, adminsOrOwnOrderCreate } from './access/adminsOrCustomer';
import { clearUserCart } from './hooks/clearUserCart';
import { updateUserPurchases } from './hooks/updateUserPurchases';
import type { OrderCollectionDocument } from './types';

export const Orders: RevealCollectionConfig<OrderCollectionDocument> = {
  slug: 'orders',
  admin: {
    useAsTitle: 'createdAt',
    defaultColumns: ['createdAt', 'customerId', 'status', 'totalInCents', 'currency'],
    preview: (doc: Record<string, unknown>) => `${config.reveal.publicServerURL}/orders/${doc.id}`,
  },
  hooks: {
    afterChange: [updateUserPurchases, clearUserCart],
  },
  access: {
    read: adminsOrCustomer,
    update: isAdmin,
    create: adminsOrOwnOrderCreate,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'customerId',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ORDER_STATUSES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      minLength: 3,
      maxLength: 3,
    },
    {
      name: 'stripePaymentIntentId',
      label: 'Stripe Payment Intent ID',
      type: 'text',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'totalInCents',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'items',
      type: 'array',
      fields: [
        {
          name: 'productId',
          type: 'text',
          required: true,
        },
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'priceInCents',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
      ],
    },
    { name: 'shippingAddress', type: 'json' },
    { name: 'metadata', type: 'json' },
    { name: 'createdAt', type: 'date', required: true },
    { name: 'updatedAt', type: 'date', required: true },
  ],
};
