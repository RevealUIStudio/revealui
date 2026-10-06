import { isSuperAdmin as holdsSuperAdmin } from '@revealui/utils/validation';

/**
 * Exact super-admin marker. Shell owner does not pass unless the
 * super-admin role (or a verified operator marker) is also present.
 * Users and Tenants collections stay on this narrower gate.
 */
export const isSuperAdmin = async ({ req }: { req: { user?: unknown } }): Promise<boolean> => {
  const user = req?.user;
  if (!user || typeof user !== 'object') return false;
  return holdsSuperAdmin(user);
};
