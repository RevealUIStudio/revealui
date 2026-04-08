import type { AccessArgs, AccessFunction } from '@revealui/core';

export const authenticated: AccessFunction = ({ req }: AccessArgs) => {
  return Boolean(req?.user);
};
