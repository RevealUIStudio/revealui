import type { Access } from "payload";

export const isUserLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user);
};
