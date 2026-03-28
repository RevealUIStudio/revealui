import type { AccessArgs, AccessFunction } from '@revealui/core';

export const authenticatedOrPublished: AccessFunction = ({ req }: AccessArgs) => {
  if (req?.user) {
    return true;
  }

  return {
    _status: {
      equals: 'published',
    },
  };
};
