import type { Access, PayloadRequest } from '../types/index';

export const anyone: Access = () => true;

export const authenticated: Access = ({ req }: { req: PayloadRequest }) => {
  return !!req.user;
};

export function isAdmin({ req }: { req: PayloadRequest }): boolean {
  return authenticated({ req }) && req.user?.roles?.includes('admin');
}

export function isSuperAdmin({ req }: { req: PayloadRequest }): boolean {
  return authenticated({ req }) && req.user?.roles?.includes('super-admin');
}

export function hasRole(role: string): Access {
  return ({ req }: { req: PayloadRequest }) => {
    return authenticated({ req }) && req.user?.roles?.includes(role);
  };
}

export function hasAnyRole(roles: string[]): Access {
  return ({ req }: { req: PayloadRequest }) => {
    return authenticated({ req }) && roles.some(role => req.user?.roles?.includes(role));
  };
}

