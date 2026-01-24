import type { CollectionAfterChangeHook, RevealHookContext } from '@revealui/core'
import type { User } from '@revealui/core/types/cms'
import { Role } from '@/lib/access/permissions/roles'

interface CreateTenantContext extends RevealHookContext {
  email?: string
  password?: string
}

interface UserWithTenantID extends User {
  // biome-ignore lint/style/useNamingConvention: PascalCase matches database schema
  TenantID?: string | number
}

export const createTenant: CollectionAfterChangeHook<UserWithTenantID> = async ({
  req,
  doc,
  operation,
  context,
}) => {
  if (operation !== 'create' || doc.TenantID || !req.revealui) {
    // If operation is not 'create' or TenantID is already present, return data
    return doc
  }

  const ctx = context as CreateTenantContext | undefined
  if (!ctx?.email) {
    return doc
  }

  try {
    // Lookup an existing tenant by email
    const existingTenant = await req.revealui.find({
      collection: 'tenants',
      where: {
        email: {
          equals: ctx.email,
        },
      },
    })

    if (existingTenant.totalDocs > 0) {
      // If tenant exists, assign TenantID to the user
      return {
        ...doc,
        // biome-ignore lint/style/useNamingConvention: PascalCase matches database schema
        TenantID: existingTenant.docs[0].id,
      }
    }

    // If no existing tenant, create a new tenant
    const newTenant = await req.revealui.create({
      collection: 'tenants',
      data: {
        email: ctx.email,
        password: ctx.password,
        roles: [Role.TenantAdmin],
      },
    })

    // Assign the new TenantID to the user
    return {
      ...doc,
      // biome-ignore lint/style/useNamingConvention: PascalCase matches database schema
      TenantID: newTenant.id,
    }
  } catch (error: unknown) {
    // Log error and return data as-is to avoid breaking execution
    req?.revealui?.logger?.error(`Error creating Tenant: ${error}`)
    return doc
  }
}
