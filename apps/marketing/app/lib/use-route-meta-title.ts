import { useRouter } from '@revealui/router';
import { useEffect, useSyncExternalStore } from 'react';

function setMeta(selector: string, attr: string, value: string): void {
  document.querySelector<HTMLElement>(selector)?.setAttribute(attr, value);
}

/**
 * Apply the matched route's `meta.title` to the live document head.
 *
 * Marketing is a Vite SPA: `index.html` ships the home SEO title for every
 * path. The router stores per-route titles but never writes them on the
 * client. Home (`/`) stays with `useAudienceHead` so audience variants keep
 * the long homepage string.
 */
export function useRouteMetaTitle(): void {
  const router = useRouter();
  const match = useSyncExternalStore(
    (callback) => router.subscribe(callback),
    () => router.getCurrentMatch(),
    () => router.getCurrentMatch(),
  );

  const title = typeof match?.route.meta?.title === 'string' ? match.route.meta.title : null;
  const path = match?.route.path;

  useEffect(() => {
    if (title === null || path === '/') {
      return;
    }

    document.title = title;
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[name="twitter:title"]', 'content', title);
  }, [path, title]);
}
