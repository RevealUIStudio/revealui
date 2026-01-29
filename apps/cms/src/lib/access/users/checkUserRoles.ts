import type { Role } from '../permissions/roles.js'
import { hasRole } from '../roles/hasRole.js'

// Re-use the same user type that hasRole uses
type UserType = Parameters<typeof hasRole>[0]

// General function to check user roles
export const checkUserRoles = (user: UserType, requiredRoles: Role[] = []): boolean => {
  return hasRole(user, requiredRoles)
}
