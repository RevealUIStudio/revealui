import type { FieldAccess, FieldAccessArgs } from '@revealui/core'
import type { Tenant, User } from '@revealui/core/types/cms'
import { Role } from '../permissions/roles'
import { hasRole } from '../roles/hasRole'
import { isSuperAdmin } from '../roles/isSuperAdmin'

// Type for the user with tenant relationships
type UserWithTenants = User & {
  tenants?: Array<{
    tenant: number | Tenant
    roles: string[]
    id?: string | null
  }> | null
}

// Type guard to check if user has tenants property
function isUserWithTenants(user: User | undefined): user is UserWithTenants {
  return user !== undefined
}

// Check if the user is a tenant admin or super admin
export const isTenantAdminOrSuperAdmin: FieldAccess<unknown, unknown> = async ({
  req,
}: FieldAccessArgs<unknown, unknown>): Promise<boolean> => {
  const user = req?.user
  const revealui = req?.revealui

  // If no user or revealui is present, deny access
  if (!user || !isUserWithTenants(user) || !revealui) {
    return false
  }

  // Always allow super admins
  if (await isSuperAdmin({ req })) return true

  // Check if the user has global tenant admin roles
  if (hasRole(user, [Role.TenantAdmin, Role.TenantSuperAdmin])) {
    return true
  }

  // Additional logic: Check if the user is an admin of the tenant by host
  const host = req.headers?.get?.('host') || ''
  const foundTenants = await revealui.find({
    collection: 'tenants',
    where: { 'domains.domain': { equals: host } },
    depth: 0,
    limit: 1,
    req,
  })

  if (foundTenants.totalDocs === 0) {
    return false
  }

  // Check if the user is an admin of the found tenant
  const userTenants = user.tenants
  if (!userTenants || !Array.isArray(userTenants)) {
    return false
  }

  const tenantWithUser = userTenants.find(
    ({ tenant: userTenant }) => userTenant === foundTenants.docs[0].id,
  )

  return tenantWithUser !== undefined
}
