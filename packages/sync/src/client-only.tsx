'use client';

import { type ReactNode, useSyncExternalStore } from 'react';

const noop = (): void => {
  // The mounted store never changes after subscription; nothing to clean up.
};
const emptySubscribe = (): (() => void) => noop;
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

/**
 * Renders children only after client mount. Server prerender (and the
 * hydration pass) renders nothing.
 *
 * Sync hooks construct an Electric `ShapeStream` during render, and the
 * Electric client requires an absolute URL (`new URL(url)` with no base).
 * During server prerender there is no `window.location` to resolve against,
 * so any component calling a shape hook throws `TypeError: Invalid URL`
 * when server-rendered (Sentry REVEALUI-ADMIN-8). Realtime shape surfaces
 * have no prerender value; gate them behind this boundary:
 *
 * ```tsx
 * export default function Page() {
 *   return (
 *     <ClientOnly>
 *       <PageInner />
 *     </ClientOnly>
 *   );
 * }
 * ```
 *
 * Implemented with `useSyncExternalStore` (server snapshot `false`, client
 * snapshot `true`) so the mount flip is hydration-safe without an effect.
 */
export function ClientOnly({ children }: { children: ReactNode }): ReactNode {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  return mounted ? children : null;
}
