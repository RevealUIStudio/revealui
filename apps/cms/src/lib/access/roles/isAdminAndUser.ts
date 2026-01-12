import { Role } from '../permissions/roles'
import { hasRole } from './hasRole'

export const isAdminAndUser = ({ req }: { req: { user?: unknown } }) => {
  const user = req?.user as { globalRoles?: string[]; roles?: string[] } | null

  // If no user is present, deny access
  if (!user) {
    return false
  }

  // Check if the user has 'user-admin' and 'tenant-admin' roles and the 'user' role
  const isUserAdmin = hasRole(user, [Role.UserAdmin])
  const isTenantAdmin = hasRole(user, [Role.TenantAdmin])
  const isUser = hasRole(user, [Role.User])

  return isUserAdmin && isTenantAdmin && isUser
}
