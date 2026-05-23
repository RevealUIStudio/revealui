/**
 * Lazy loaders for `@revealui/services`.
 *
 * `@revealui/services` is declared as an optional peer dependency in
 * apps/server/package.json so OSS deployments and Docker runtime images
 * (where pnpm deploy --legacy leaves optional peers as workspace symlinks
 * that dangle outside the build) can omit it. Static top-level imports
 * therefore crash module resolution at startup; consumers must go through
 * these cached dynamic-import getters and 503 when the result is null.
 *
 * Same pattern as `getAiModule` in routes/a2a.ts. Established by 8c19db537
 * (fix(api): convert services import to dynamic for Pro boundary compliance).
 */

let servicesPromise: Promise<typeof import('@revealui/services') | null> | null = null;
let servicesEmailPromise: Promise<typeof import('@revealui/services/email') | null> | null = null;

export function getServices(): Promise<typeof import('@revealui/services') | null> {
  if (!servicesPromise) {
    servicesPromise = import('@revealui/services').catch(() => null);
  }
  return servicesPromise;
}

export function getServicesEmail(): Promise<typeof import('@revealui/services/email') | null> {
  if (!servicesEmailPromise) {
    servicesEmailPromise = import('@revealui/services/email').catch(() => null);
  }
  return servicesEmailPromise;
}

/** Type alias for the protectedStripe wrapper (erased at runtime). */
export type ProtectedStripe = NonNullable<
  Awaited<ReturnType<typeof getServices>>
>['protectedStripe'];
