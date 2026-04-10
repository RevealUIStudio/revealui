import type { CollectionConfig } from '@revealui/core';
import { isAdmin } from '@/lib/access';

const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  admin: {
    // useAsTitle: "id", // Use the Stripe subscription ID as the title
  },
  // Subscriptions are managed exclusively by Stripe webhooks — no admin user should
  // be able to create, update, or delete them. Read access is restricted to admins.
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'id',
      label: 'Subscription ID',
      type: 'text',
      required: true,
      unique: true, // Ensure uniqueness of the Stripe subscription ID
    },
    {
      name: 'userId',
      label: 'User ID',
      type: 'relationship',
      relationTo: 'users', // Assuming a 'users' collection exists
      required: true,
      unique: true,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        // Example of Stripe subscription statuses
        { label: 'Active', value: 'active' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Incomplete', value: 'incomplete' },
        { label: 'Incomplete Expired', value: 'incomplete_expired' },
        { label: 'Trialing', value: 'trialing' },
        { label: 'Unpaid', value: 'unpaid' },
      ],
    },
    {
      name: 'priceId',
      label: 'Price ID',
      type: 'text',
      required: true,
    },
    {
      name: 'quantity',
      label: 'Quantity',
      type: 'number',
    },
    {
      name: 'cancelAt',
      label: 'Cancel At',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'canceledAt',
      label: 'Canceled At',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'currentPeriodStart',
      label: 'Current Period Start',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'currentPeriodEnd',
      label: 'Current Period End',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'trialStart',
      label: 'Trial Start',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'trialEnd',
      label: 'Trial End',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'metadata',
      label: 'Metadata',
      type: 'json',
    },
  ],
};

export default Subscriptions;
