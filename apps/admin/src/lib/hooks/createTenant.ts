import type {
  CollectionAfterChangeHook,
  RevealHookContext,
  RevealUIInstance,
} from '@revealui/core';
import type { User } from '@revealui/core/types/admin';
import { Role } from '@/lib/access/permissions/roles';

interface CreateTenantContext extends RevealHookContext {
  email?: string;
  password?: string;
}

interface UserWithTenantID extends User {
  TenantID?: string | number;
}

export const createTenant: CollectionAfterChangeHook<UserWithTenantID> = async ({
  req,
  doc,
  operation,
  context,
}) => {
  if (operation !== 'create' || doc.TenantID || !req.revealui) {
    // If operation is not 'create' or TenantID is already present, return data
    return doc;
  }

  // contracts RevealRequest.revealui is typed as unknown; cast to the known instance type
  const revealui = req.revealui as RevealUIInstance;

  // context is typed as RevealHookContext (Record-like); narrow to check for expected fields
  const ctx = context as CreateTenantContext | undefined;
  if (!ctx?.email) {
    return doc;
  }

  try {
    // Lookup an existing tenant by email
    const existingTenant = await revealui.find({
      collection: 'tenants',
      where: {
        email: {
          equals: ctx.email,
        },
      },
    });

    if (existingTenant.totalDocs > 0 && existingTenant.docs[0]) {
      // If tenant exists, assign TenantID to the user.
      // find() returns unknown for the id field; cast to satisfy UserWithTenantID.
      return {
        ...doc,
        TenantID: existingTenant.docs[0].id as string | number,
      } as UserWithTenantID;
    }

    // If no existing tenant, create a new tenant
    const newTenant = await revealui.create({
      collection: 'tenants',
      data: {
        email: ctx.email,
        // password may be undefined; RevealValue requires a defined value, skip if absent
        ...(ctx.password !== undefined ? { password: ctx.password } : {}),
        roles: [Role.TenantAdmin],
      },
    });

    // Assign the new TenantID to the user.
    // create() returns unknown for the id field; cast to satisfy UserWithTenantID.
    return {
      ...doc,
      TenantID: newTenant.id as string | number,
    } as UserWithTenantID;
  } catch (error: unknown) {
    // Log error and return data as-is to avoid breaking execution
    revealui.logger.error(`Error creating Tenant: ${error}`);
    return doc;
  }
};
