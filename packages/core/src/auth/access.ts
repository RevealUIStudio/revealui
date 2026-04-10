import type { AccessResult } from '../types/index.js';

// User type with roles for access control
interface UserWithRoles {
  id?: string | number;
  email?: string;
  roles?: string[];
}

// Request type for access functions
interface AccessRequest {
  user?: UserWithRoles | null;
  revealui?: unknown;
}

// Access function type for RevealUI admin
type RevealAccessFunction = (args: { req: AccessRequest }) => AccessResult | Promise<AccessResult>;

export const anyone: RevealAccessFunction = () => true;

export const authenticated: RevealAccessFunction = ({ req }) => {
  return !!req.user;
};

export function isAdmin({ req }: { req: AccessRequest }): boolean {
  return !!req.user && !!req.user.roles?.includes('admin');
}

export function isSuperAdmin({ req }: { req: AccessRequest }): boolean {
  return !!req.user && !!req.user.roles?.includes('super-admin');
}

export function hasRole(role: string): RevealAccessFunction {
  return ({ req }) => {
    return !!req.user && !!req.user.roles?.includes(role);
  };
}

export function hasAnyRole(roles: string[]): RevealAccessFunction {
  return ({ req }) => {
    return !!req.user && roles.some((role) => req.user?.roles?.includes(role));
  };
}
