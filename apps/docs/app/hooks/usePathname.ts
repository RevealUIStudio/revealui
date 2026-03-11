import { useRouter } from '@revealui/router';
import { useSyncExternalStore } from 'react';

/**
 * Subscribe to the router and return the current pathname.
 * Replaces react-router-dom's useLocation().pathname.
 */
export function usePathname(): string {
  const router = useRouter();
  return useSyncExternalStore(
    (cb) => router.subscribe(cb),
    () => window.location.pathname,
    () => '/',
  );
}
