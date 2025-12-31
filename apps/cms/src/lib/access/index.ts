import { isAdmin } from "./roles/isAdmin";
import { isAdminAndUser } from "./roles/isAdminAndUser";
import { isAdminOrLoggedIn } from "./roles/isAdminOrLoggedIn";
import { isAdminOrPublished } from "./roles/isAdminOrPublished";
import { anyone } from "./roles/anyone";
import { authenticated } from "./roles/authenticated";
import { isUserOrTenant } from "./roles/isUserOrTenant";
import { isSuperAdmin } from "./roles/isSuperAdmin";
import { lastLoggedInTenant } from "./tenants/lastLoggedInTenant";
import { isUserLoggedIn } from "./users/isUserLoggedIn";

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
};
