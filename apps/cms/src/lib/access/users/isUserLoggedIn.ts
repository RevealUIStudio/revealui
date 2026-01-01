import type { Access } from "@revealui/cms";

export const isUserLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user);
};
