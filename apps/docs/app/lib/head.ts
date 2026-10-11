/**
 * Document-head manager for the docs SPA.
 *
 * `index.html` carries the static defaults that crawlers without JS see;
 * this helper keeps the live DOM in sync during client-side navigation and
 * lets markdown frontmatter (`title`, `description`) override the head per
 * page. OG images come from the same satori renderer in apps/server that
 * the marketing app uses (see apps/marketing/app/lib/og.ts).
 */

import { DEFAULT_DESCRIPTION, SITE_TITLE } from './site-copy';

export { DEFAULT_DESCRIPTION, SITE_TITLE };

const viteEnv = import.meta.env;
const OG_BASE_URL = `${
  viteEnv?.VITE_API_URL ?? (viteEnv?.PROD ? 'https://api.revealui.com' : 'http://localhost:3004')
}/api/og`;

export function buildOgUrl(title: string, description?: string): string {
  const params = new URLSearchParams({ title });
  if (description !== undefined && description !== '') {
    params.set('description', description);
  }
  return `${OG_BASE_URL}?${params.toString()}`;
}

export const DOCS_ORIGIN = 'https://docs.revealui.com';

export interface DocHead {
  /** Page title, rendered as "<title> · RevealUI Docs". Omitted/empty = site default. */
  title?: string;
  /** Meta description. Omitted/empty = site default. */
  description?: string;
  /** Override the live pathname. Defaults to window.location.pathname. */
  pathname?: string;
  /** Not-found views: noindex and no canonical. */
  noindex?: boolean;
}

/** Self-referencing canonical for a docs pathname. Home is the origin with a slash. */
export function docsCanonicalUrl(pathname: string): string {
  let path = pathname;
  const hash = path.indexOf('#');
  if (hash !== -1) {
    path = path.slice(0, hash);
  }
  const query = path.indexOf('?');
  if (query !== -1) {
    path = path.slice(0, query);
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path === '' || path === '/') {
    return `${DOCS_ORIGIN}/`;
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${DOCS_ORIGIN}${path}`;
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el === null) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (el === null) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function removeCanonical(): void {
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[property="og:url"]')?.remove();
}

/** Set or remove `<meta name="robots" content="noindex, nofollow">`. */
export function setRobotsNoindex(on: boolean): void {
  if (on) {
    setMeta('name', 'robots', 'noindex, nofollow');
    removeCanonical();
    return;
  }
  document.head.querySelector('meta[name="robots"]')?.remove();
}

/** Apply per-page head state; omitted fields restore the site defaults. */
export function applyDocHead(head: DocHead = {}): void {
  const pageTitle = head.title?.trim() ?? '';
  const fullTitle = pageTitle === '' ? SITE_TITLE : `${pageTitle} · RevealUI Docs`;
  const rawDescription = head.description?.trim() ?? '';
  const description = rawDescription === '' ? DEFAULT_DESCRIPTION : rawDescription;
  const imageTitle = pageTitle === '' ? SITE_TITLE : pageTitle;
  const ogImage = buildOgUrl(imageTitle, description);
  const pathname = head.pathname ?? window.location.pathname;

  document.title = fullTitle;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', ogImage);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', ogImage);

  if (head.noindex) {
    setRobotsNoindex(true);
    return;
  }
  document.head.querySelector('meta[name="robots"]')?.remove();
  const canonical = docsCanonicalUrl(pathname);
  setLink('canonical', canonical);
  setMeta('property', 'og:url', canonical);
}
