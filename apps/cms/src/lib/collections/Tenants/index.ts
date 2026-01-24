import type { CollectionConfig } from '@revealui/core'
import { Role } from '@/lib/access/permissions/roles'
import { isSuperAdmin } from '../../access'
import { isTenantAdminOrSuperAdmin } from '../../access/tenants/isTenantAdminOrSuperAdmin'
import { createTenant, recordLastLoggedInTenant } from '../../hooks'

export const Tenants: CollectionConfig = {
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
    afterChange: [createTenant],
    afterLogin: [recordLastLoggedInTenant],
  },
}
// export const Tenants: CollectionConfig = {
//   slug: "tenants",
//   access: {
//     create: isSuperAdmin,
//     read: isTenantAdminOrSuperAdmin,
//     update: isTenantAdminOrSuperAdmin,
//     delete: isSuperAdmin,
//   },
//   admin: {
//     useAsTitle: "name",
//   },
//   fields: [
//     {
//       name: "name",
//       type: "text",
//       required: true,
//     },
//     {
//       name: "domains",
//       type: "array",
//       index: true,
//       fields: [
//         {
//           name: "domain",
//           type: "text",
//           required: true,
//         },
//       ],
//     },
//     {
//       name: "roles",
//       type: "array",
//       required: true,
//       fields: [],
//     },
//   ],
//   hooks: {
//     afterChange: [],
//     afterLogin: [recordLastLoggedInTenant],
//   },
// };
