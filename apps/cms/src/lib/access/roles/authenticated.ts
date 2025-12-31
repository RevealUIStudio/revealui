import type { AccessArgs, User } from "payload";

type isAuthenticated = (args: AccessArgs<User>) => boolean;

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user);
};
