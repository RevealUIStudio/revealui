import { isAdmin as holdsAdmin } from '@revealui/utils/validation';

/** Collection gate. Same ladder as every route admin check. */
export const isAdmin = ({ req }: { req: { user?: unknown } }): boolean => {
  const user = req?.user;
  if (!user || typeof user !== 'object') return false;
  return holdsAdmin(user);
};
