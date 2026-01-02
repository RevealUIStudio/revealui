import type { CollectionAfterChangeHook } from '@revealui/cms'
import { Role } from '@/lib/access/permissions/roles'

/* eslint-disable @typescript-eslint/no-explicit-any */
export const createTenant: CollectionAfterChangeHook = async ({
  req,
  doc,
  operation,
  context,
}: {
  req: any
  doc: any
  operation: string
  context?: any
}) => {
  if (operation !== 'create' || doc.TenantID) {
    // If operation is not 'create' or TenantID is already present, return data
    return doc
  }

  try {
    // Lookup an existing tenant by email
    const existingTenant = await req.payload.find({
      collection: 'tenants',
      where: {
        email: {
          equals: context.email,
        },
      },
    })

    if (existingTenant.totalDocs > 0) {
      // If tenant exists, assign TenantID to the user
      return {
        ...doc,
        TenantID: existingTenant.docs[0].id,
      }
    }

    // If no existing tenant, create a new tenant
    const newTenant = await req.payload.create({
      collection: 'users',
      data: {
        email: context.email,
        password: context.password,
        roles: [Role.TenantAdmin],
      },
    })

    // Assign the new TenantID to the user
    return {
      ...doc,
      TenantID: newTenant.id,
    }
  } catch (error: unknown) {
    // Log error and return data as-is to avoid breaking execution
    req?.payload?.logger.error(`Error creating Tenant: ${error}`)
    return doc
  }
}
