'use client';

import { createContext, type ReactNode, use, useMemo, useSyncExternalStore } from 'react';

interface ElectricContextValue {
  /**
   * Direct Electric service URL (e.g. the Railway instance).
   * Stored in context for future use  -  not consumed by the current proxy-based hooks.
   * All hooks use proxyBaseUrl + /api/shapes/* instead.
   */
  serviceUrl: string | null;
  /**
   * Base URL prefix for authenticated admin shape proxy routes.
   * The Electric client requires an absolute shape URL (`new URL(url)` with
   * no base), so this must never be relative at fetch time. When unset, the
   * provider defaults to `window.location.origin` in the browser; during
   * server prerender it stays '' — shape-hook components must therefore be
   * gated behind `ClientOnly` (see `client-only.tsx`).
   * Set to 'https://admin.revealui.com' when consuming from a different origin.
   */
  proxyBaseUrl: string;
  debug: boolean;
}

const ElectricContext = createContext<ElectricContextValue>({
  serviceUrl: null,
  proxyBaseUrl: '',
  debug: false,
});

const noop = (): void => {
  // Page origin never changes after subscribe in a normal document.
};
const emptySubscribe = (): (() => void) => noop;
const getClientOrigin = (): string => window.location.origin;
const getServerOrigin = (): string => '';

function resolveProxyBaseUrl(explicit: string | undefined, origin: string): string {
  const trimmed = explicit?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : origin;
}

/**
 * Provides ElectricSQL configuration to child hooks (`useConversations`, `useCollabDocument`).
 *
 * Provides proxyBaseUrl (and optional serviceUrl/debug) to child hooks via context.
 * All hooks use the admin proxy pattern  -  no direct Electric connection is established here.
 *
 * `proxyBaseUrl` must be absolute at fetch time. A `useMemo` over `typeof window`
 * freezes the SSR empty string after hydration (ClientOnly then mounts shape
 * hooks against `/api/shapes/...`, and Electric throws Invalid URL). Read the
 * page origin through `useSyncExternalStore` so the client snapshot replaces
 * the empty server snapshot. Treat blank explicit props as unset.
 */
export function ElectricProvider(props: {
  children: ReactNode;
  serviceUrl?: string;
  proxyBaseUrl?: string;
  debug?: boolean;
}): ReactNode {
  const pageOrigin = useSyncExternalStore(emptySubscribe, getClientOrigin, getServerOrigin);
  const value = useMemo(
    () => ({
      serviceUrl: props.serviceUrl ?? null,
      proxyBaseUrl: resolveProxyBaseUrl(props.proxyBaseUrl, pageOrigin),
      debug: props.debug ?? false,
    }),
    [props.serviceUrl, props.proxyBaseUrl, props.debug, pageOrigin],
  );

  return <ElectricContext value={value}>{props.children}</ElectricContext>;
}

/**
 * Access the ElectricSQL configuration provided by `ElectricProvider`.
 * Returns `{ serviceUrl: null, debug: false }` if no provider is present.
 */
export function useElectricConfig(): ElectricContextValue {
  return use(ElectricContext);
}
