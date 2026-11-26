import { useRouter } from '@revealui/router';
import { useEffect, useSyncExternalStore } from 'react';
import { publishDocumentHead } from './document-head';
import { marketingCanonical, marketingOgImage, shellHeadForPath } from './route-heads';

function upsertMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el === null) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function upsertCanonical(href: string): void {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (el === null) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeCanonical(): void {
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
}

function setRobots(content: string | null): void {
  const existing = document.head.querySelector('meta[name="robots"]');
  if (content === null) {
    existing?.remove();
    return;
  }
  if (existing === null) {
    const el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    el.setAttribute('content', content);
    document.head.appendChild(el);
    return;
  }
  existing.setAttribute('content', content);
}

/**
 * Apply the matched route's head to the live document.
 * Production HTML already carries the same tags (prerendered shells).
 * Home (`/`) stays with `useAudienceHead` so audience variants keep
 * the long homepage string. The 404 view is noindex and has no canonical.
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
  const isNotFound = path === '/*notfound';
  const listed = path === undefined ? undefined : shellHeadForPath(path);
  const description = isNotFound
    ? "The page you're looking for doesn't exist or has moved."
    : typeof match?.route.meta?.description === 'string'
      ? match.route.meta.description
      : (listed?.description ?? 'Read RevealUI documentation and current product information.');

  useEffect(() => {
    if (title === null || path === '/' || path === undefined) {
      return;
    }

    if (isNotFound) {
      document.title = title;
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:title', title);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:title', title);
      upsertMeta('name', 'twitter:description', description);
      setRobots('noindex');
      removeCanonical();
      publishDocumentHead();
      return;
    }

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:description', description);
    const canonical = marketingCanonical(window.location.pathname);
    upsertCanonical(canonical);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:title', title);
    upsertMeta('name', 'twitter:title', title);
    const image = marketingOgImage(title, description);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:image:alt', title);
    upsertMeta('name', 'twitter:image', image);
    setRobots(null);
    publishDocumentHead();
  }, [path, title, description, isNotFound]);
}
