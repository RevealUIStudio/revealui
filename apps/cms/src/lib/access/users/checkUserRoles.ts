import { hasRole } from '../roles/hasRole'
import { Role } from '../permissions/roles'

// Re-use the same user type that hasRole uses
type UserType = Parameters<typeof hasRole>[0]

// General function to check user roles
export const checkUserRoles = (user: UserType, requiredRoles: Role[] = []): boolean => {
  return hasRole(user, requiredRoles)
}
