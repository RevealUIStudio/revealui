import { anyone } from './roles/anyone.js'
import { authenticated } from './roles/authenticated.js'
import { isAdmin } from './roles/isAdmin.js'
import { isAdminAndUser } from './roles/isAdminAndUser.js'
import { isAdminOrLoggedIn } from './roles/isAdminOrLoggedIn.js'
import { isAdminOrPublished } from './roles/isAdminOrPublished.js'
import { isSuperAdmin } from './roles/isSuperAdmin.js'
import { isUserOrTenant } from './roles/isUserOrTenant.js'
import { lastLoggedInTenant } from './tenants/lastLoggedInTenant.js'
import { isUserLoggedIn } from './users/isUserLoggedIn.js'

export {
  isAdmin,
  isAdminAndUser,
  isAdminOrLoggedIn,
  isAdminOrPublished,
  anyone,
  authenticated,
  isUserLoggedIn,
  isSuperAdmin,
  isUserOrTenant,
  lastLoggedInTenant,
}
