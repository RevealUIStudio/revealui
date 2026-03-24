import { deepMerge } from '@revealui/core';
import { createTenant } from './createTenant';
import { ensureFirstUserIsSuperAdmin } from './ensureFirstUserIsSuperAdmin';
import { loginAfterCreate } from './loginAfterCreate';
import { populateArchiveBlock } from './populateArchiveBlock';
import { populatePublishedAt } from './populatePublishedAt';
import { recordLastLoggedInTenant } from './recordLastLoggedInTenant';
import { revalidate } from './revalidate';
import { revalidatePage } from './revalidatePage';
import { tenantProxy } from './tenantProxy';

export {
  createTenant,
  deepMerge,
  ensureFirstUserIsSuperAdmin,
  loginAfterCreate,
  populateArchiveBlock,
  populatePublishedAt,
  recordLastLoggedInTenant,
  revalidate,
  revalidatePage,
  tenantProxy,
};
