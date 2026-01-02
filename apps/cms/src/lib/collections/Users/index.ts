/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CollectionConfig } from '@revealui/cms'
import { anyone, isAdmin, isAdminAndUser, isSuperAdmin } from '../../access'
import { isTenantAdminOrSuperAdmin } from '../../access/tenants/isTenantAdminOrSuperAdmin'
import { loginAfterCreate, recordLastLoggedInTenant } from '../../hooks'

const Users: CollectionConfig = {
  slug: 'users',
  timestamps: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email'],
  },
  auth: {
    useAPIKey: true,
  },
  access: {
    create: isAdmin,
    read: anyone,
    update: isAdminAndUser,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [loginAfterCreate],
    afterLogin: [recordLastLoggedInTenant],
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
          value: 'user-super-admin', // Differentiate value
        },
        {
          label: 'Admin',
          value: 'user-admin', // Differentiate value
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
}

export default Users
