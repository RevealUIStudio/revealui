import type { User } from "@revealui/cms";

export const authenticated = ({ req: { user } }: { req: { user?: User } }) => {
  return Boolean(user);
};
