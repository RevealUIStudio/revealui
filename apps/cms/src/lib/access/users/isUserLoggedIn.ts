import type { AccessArgs, AccessFunction } from '@revealui/core';

export const isUserLoggedIn: AccessFunction = ({ req }: AccessArgs) => {
  return Boolean(req?.user);
};
