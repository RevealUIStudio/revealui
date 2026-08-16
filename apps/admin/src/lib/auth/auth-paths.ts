/**
 * Auth-flow paths that must not carry site chrome (header, footer, admin bar).
 * Shared by the (frontend) layout, AdminBar, and proxy.
 */
export const AUTH_PATHS = [
  '/login',
  '/signup',
  '/setup',
  '/mfa',
  '/rotate-password',
  '/forgot-password',
  '/reset-password',
] as const;

export type AuthPath = (typeof AUTH_PATHS)[number];

export function isAuthPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return AUTH_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
