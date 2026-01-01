import { deepMerge } from "@revealui/cms";
import { ensureFirstUserIsSuperAdmin } from "./ensureFirstUserIsSuperAdmin";
import { createTenant } from "./createTenant";
import { tenantProxy } from "./tenantProxy";
import { loginAfterCreate } from "./loginAfterCreate";
import { recordLastLoggedInTenant } from "./recordLastLoggedInTenant";
import { isObject } from "./isObject";
import { revalidate } from "./revalidate";
import { revalidatePage } from "./revalidatePage";
import { populateArchiveBlock } from "./populateArchiveBlock";
import { populatePublishedAt } from "./populatePublishedAt";

export {
  createTenant,
  ensureFirstUserIsSuperAdmin,
  tenantProxy,
  loginAfterCreate,
  recordLastLoggedInTenant,
  deepMerge,
  isObject,
  revalidate,
  revalidatePage,
  populateArchiveBlock,
  populatePublishedAt,
};
