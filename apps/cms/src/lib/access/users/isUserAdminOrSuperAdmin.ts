import type { RevealUser } from '@revealui/core'
import { checkUserRoles } from './checkUserRoles'

export const isUserAdminOrSuperAdmin = (user: RevealUser): boolean => {
  return checkUserRoles(user, [])
}
