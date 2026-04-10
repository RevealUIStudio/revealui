'use client';

import { createContext, type ReactNode, use, useMemo } from 'react';

interface ElectricContextValue {
  /**
   * Direct Electric service URL (e.g. the Railway instance).
   * Stored in context for future use — not consumed by the current proxy-based hooks.
   * All hooks use proxyBaseUrl + /api/shapes/* instead.
   */
  serviceUrl: string | null;
  /**
   * Base URL prefix for authenticated CMS shape proxy routes.
   * Default '' keeps all hook URLs relative (works for same-origin apps).
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

/**
 * Provides ElectricSQL configuration to child hooks (`useConversations`, `useCollabDocument`).
 *
 * Provides proxyBaseUrl (and optional serviceUrl/debug) to child hooks via context.
 * All hooks use the CMS proxy pattern — no direct Electric connection is established here.
 */
export function ElectricProvider(props: {
  children: ReactNode;
  serviceUrl?: string;
  proxyBaseUrl?: string;
  debug?: boolean;
}): ReactNode {
  const value = useMemo(
    () => ({
      serviceUrl: props.serviceUrl ?? null,
      proxyBaseUrl: props.proxyBaseUrl ?? '',
      debug: props.debug ?? false,
    }),
    [props.serviceUrl, props.proxyBaseUrl, props.debug],
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
