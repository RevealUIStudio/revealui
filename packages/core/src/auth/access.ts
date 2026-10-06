import {
  hasAnyRole as subjectHasAnyRole,
  hasRole as subjectHasRole,
  isAdmin as subjectIsAdmin,
  isSuperAdmin as subjectIsSuperAdmin,
} from '@revealui/utils/validation';
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
  return subjectIsAdmin(req.user);
}

export function isSuperAdmin({ req }: { req: AccessRequest }): boolean {
  return subjectIsSuperAdmin(req.user);
}

export function hasRole(role: string): RevealAccessFunction {
  return ({ req }) => subjectHasRole(req.user, role);
}

export function hasAnyRole(roles: string[]): RevealAccessFunction {
  return ({ req }) => subjectHasAnyRole(req.user, roles);
}
