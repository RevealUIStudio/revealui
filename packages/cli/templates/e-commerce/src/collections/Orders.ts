import type { CollectionConfig } from '@revealui/contracts'

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: 'Order', plural: 'Orders' },
  fields: [
    {
      name: 'customer',
      type: 'text',
      required: true,
      admin: {
        description: 'Customer email address',
      },
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
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
          defaultValue: 1,
        },
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0,
          admin: {
            description: 'Price at time of purchase (cents)',
          },
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Order total in cents',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Shipped', value: 'shipped' },
      ],
    },
  ],
}
