import type { RevealCollectionConfig } from '@revealui/core';
import type { User } from '@revealui/core/types/admin';
import { isAdmin, isAdminAndUser, isSuperAdmin } from '@/lib/access';
import { isTenantAdminOrSuperAdmin } from '@/lib/access/tenants/isTenantAdminOrSuperAdmin';
import { loginAfterCreate, recordLastLoggedInTenant } from '@/lib/hooks/index';

const Users: RevealCollectionConfig<User> = {
  slug: 'users',
  timestamps: true,
  mcpResource: false,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email'],
  },
  auth: {
    useAPIKey: true,
  },
  access: {
    create: isAdmin,
    read: ({ req }) => {
      const user = req?.user as { id?: string } | null;
      if (!user?.id) return false;
      if (isAdmin({ req })) return true;
      return { id: { equals: user.id } };
    },
    update: isAdminAndUser,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [loginAfterCreate as never],
    afterLogin: [recordLastLoggedInTenant as never],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'password',
      type: 'text',
      required: true,
      access: {
        read: () => false, // Never expose password in API responses
        update: isAdminAndUser,
      },
    },
    {
      name: 'firstName',
      type: 'text',
    },
    {
      name: 'lastName',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      access: {
        create: isSuperAdmin,
        update: isSuperAdmin,
        read: isSuperAdmin,
      },
      options: [
        {
          label: 'Super Admin',
          value: 'super-admin', // Differentiate value
        },
        {
          label: 'Admin',
          value: 'admin', // Differentiate value
        },
      ],
    },
    {
      name: 'tenants',
      type: 'array',
      label: 'Tenants',
      access: {
        create: isTenantAdminOrSuperAdmin,
        update: isTenantAdminOrSuperAdmin,
        read: isTenantAdminOrSuperAdmin,
      },
      fields: [
        {
          name: 'tenant',
          type: 'relationship',
          relationTo: 'tenants',
          required: true,
        },
        {
          name: 'roles',
          type: 'select',
          hasMany: true,
          required: true,
          options: [
            {
              label: 'Tenant Super Admin',
              value: 'tenant-super-admin', // Differentiate value
            },
            {
              label: 'Tenant Admin',
              value: 'tenant-admin', // Differentiate value
            },
          ],
        },
      ],
    },
    {
      name: 'lastLoggedInTenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      access: {
        create: () => false,
        read: isTenantAdminOrSuperAdmin,
        update: isSuperAdmin,
      },
      admin: {
        position: 'sidebar',
      },
    },
  ],
};

export default Users;
