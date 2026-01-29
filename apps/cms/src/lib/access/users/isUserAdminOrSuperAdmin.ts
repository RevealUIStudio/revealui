import type { RevealUser } from '@revealui/core'
import { checkUserRoles } from './checkUserRoles.js'

export const isUserAdminOrSuperAdmin = (user: RevealUser): boolean => {
  return checkUserRoles(user, [])
}
