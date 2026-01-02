import type { AccessFunction, AccessArgs } from "@revealui/cms";

export const authenticatedOrPublished: AccessFunction = ({ req }: AccessArgs) => {
  if (req?.user) {
    return true;
  }

  return {
    _status: {
      equals: "published",
    },
  };
};
