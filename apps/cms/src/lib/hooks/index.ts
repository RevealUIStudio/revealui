import { deepMerge } from '@revealui/core'
import { createTenant } from './createTenant.js'
import { ensureFirstUserIsSuperAdmin } from './ensureFirstUserIsSuperAdmin.js'
import { loginAfterCreate } from './loginAfterCreate.js'
import { populateArchiveBlock } from './populateArchiveBlock.js'
import { populatePublishedAt } from './populatePublishedAt.js'
import { recordLastLoggedInTenant } from './recordLastLoggedInTenant.js'
import { revalidate } from './revalidate.js'
import { revalidatePage } from './revalidatePage.js'
import { tenantProxy } from './tenantProxy.js'

export {
  createTenant,
  ensureFirstUserIsSuperAdmin,
  tenantProxy,
  loginAfterCreate,
  recordLastLoggedInTenant,
  deepMerge,
  revalidate,
  revalidatePage,
  populateArchiveBlock,
  populatePublishedAt,
}
