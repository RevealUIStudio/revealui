import type { RevealCollectionConfig } from '@revealui/core';
import type { Tenant } from '@revealui/core/types/admin';
import { isSuperAdmin } from '@/lib/access';
import { Role } from '@/lib/access/permissions/roles';
import { isTenantAdminOrSuperAdmin } from '@/lib/access/tenants/isTenantAdminOrSuperAdmin';
import { createTenant, recordLastLoggedInTenant } from '@/lib/hooks/index';

export const Tenants: RevealCollectionConfig<Tenant> = {
  slug: 'tenants',
  access: {
    create: isSuperAdmin,
    read: isTenantAdminOrSuperAdmin,
    update: isTenantAdminOrSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'password',
      type: 'text',
      access: {
        read: () => false,
      },
    },
    {
      name: 'domains',
      type: 'array',
      index: true,
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true, // Allows multiple selections
      required: true,
      options: Object.keys(Role).map((key) => ({
        label: key.replace(/([A-Z])/g, ' $1'), // Convert camel case to space-separated
        value: Role[key as keyof typeof Role], // Use enum values
      })),
    },
  ],
  hooks: {
    afterChange: [createTenant as never],
    afterLogin: [recordLastLoggedInTenant as never],
  },
};
