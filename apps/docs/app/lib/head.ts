/**
 * Document-head manager for the docs SPA.
 *
 * `index.html` carries the static defaults that crawlers without JS see;
 * this helper keeps the live DOM in sync during client-side navigation and
 * lets markdown frontmatter (`title`, `description`) override the head per
 * page. OG images come from the same satori renderer in apps/server that
 * the marketing app uses (see apps/marketing/app/lib/og.ts).
 */

const SITE_TITLE = 'RevealUI Documentation';

/** Mirrors the static default in index.html; keep the two in sync. */
const DEFAULT_DESCRIPTION =
  'Documentation for RevealUI  -  open-source agentic business runtime. Auth, billing, CMS, AI agents, and the pre-wired UI component library. Build your business, not your boilerplate.';

const OG_BASE_URL = `${
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? 'https://api.revealui.com' : 'http://localhost:3004')
}/api/og`;

export function buildOgUrl(title: string, description?: string): string {
  const params = new URLSearchParams({ title });
  if (description !== undefined && description !== '') {
    params.set('description', description);
  }
  return `${OG_BASE_URL}?${params.toString()}`;
}

export interface DocHead {
  /** Page title, rendered as "<title> · RevealUI Docs". Omitted/empty = site default. */
  title?: string;
  /** Meta description. Omitted/empty = site default. */
  description?: string;
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

/** Apply per-page head state; omitted fields restore the site defaults. */
export function applyDocHead(head: DocHead = {}): void {
  const pageTitle = head.title?.trim() ?? '';
  const fullTitle = pageTitle === '' ? SITE_TITLE : `${pageTitle} · RevealUI Docs`;
  const rawDescription = head.description?.trim() ?? '';
  const description = rawDescription === '' ? DEFAULT_DESCRIPTION : rawDescription;
  const ogImage = buildOgUrl(pageTitle === '' ? SITE_TITLE : pageTitle);

  document.title = fullTitle;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', ogImage);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', ogImage);
}
