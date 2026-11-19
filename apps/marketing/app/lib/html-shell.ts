/**
 * Rewrite the static document head inside a built index.html shell.
 * Tag walking only: no authored regular expressions.
 */

export interface HtmlShellHead {
  title: string;
  description: string;
  /** Absolute canonical. Null removes canonical and og:url. */
  canonical: string | null;
  image?: string;
  imageAlt?: string;
  /** `null` removes robots. A string sets it. Omit to leave the template alone. */
  robots?: string | null;
}

export function canonicalUrl(origin: string, routePath: string): string {
  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  if (routePath === '' || routePath === '/') {
    return `${base}/`;
  }
  let path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return `${base}${path}`;
}

/** Platform trailingSlash:false sends `/pricing/` to `/pricing`. Root stays `/`. */
export function withoutTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function shellRelativePath(routePath: string): string {
  if (routePath === '/' || routePath === '') {
    return 'index.html';
  }
  let path = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return `${path}.html`;
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
}

function tagName(raw: string): string {
  let i = 1;
  while (i < raw.length && (raw[i] === ' ' || raw[i] === '\n' || raw[i] === '\t')) {
    i += 1;
  }
  if (raw[i] === '/') {
    i += 1;
  }
  let name = '';
  while (i < raw.length) {
    const ch = raw[i] ?? '';
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '>' || ch === '/') {
      break;
    }
    name += ch.toLowerCase();
    i += 1;
  }
  return name;
}

function attr(raw: string, name: string): string | null {
  const needle = ` ${name}="`;
  const idx = raw.indexOf(needle);
  if (idx === -1) {
    return null;
  }
  const start = idx + needle.length;
  const end = raw.indexOf('"', start);
  if (end === -1) {
    return null;
  }
  return raw.slice(start, end);
}

function setQuotedAttr(raw: string, name: string, value: string): string {
  const needle = ` ${name}="`;
  const idx = raw.indexOf(needle);
  const escaped = escapeAttr(value);
  if (idx === -1) {
    const selfClose = raw.endsWith('/>');
    const insertAt = selfClose ? raw.length - 2 : raw.length - 1;
    return `${raw.slice(0, insertAt)} ${name}="${escaped}"${raw.slice(insertAt)}`;
  }
  const valueStart = idx + needle.length;
  const valueEnd = raw.indexOf('"', valueStart);
  if (valueEnd === -1) {
    return raw;
  }
  return `${raw.slice(0, valueStart)}${escaped}${raw.slice(valueEnd)}`;
}

function mapTags(source: string, map: (raw: string) => string): string {
  let result = '';
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf('<', i);
    if (start === -1) {
      result += source.slice(i);
      break;
    }
    result += source.slice(i, start);
    const end = source.indexOf('>', start);
    if (end === -1) {
      result += source.slice(start);
      break;
    }
    result += map(source.slice(start, end + 1));
    i = end + 1;
  }
  return result;
}

function removeTags(source: string, match: (raw: string) => boolean): string {
  let result = '';
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf('<', i);
    if (start === -1) {
      result += source.slice(i);
      break;
    }
    result += source.slice(i, start);
    const end = source.indexOf('>', start);
    if (end === -1) {
      result += source.slice(start);
      break;
    }
    const raw = source.slice(start, end + 1);
    if (match(raw)) {
      i = end + 1;
      if (source[i] === '\r') {
        i += 1;
      }
      if (source[i] === '\n') {
        i += 1;
      }
      continue;
    }
    result += raw;
    i = end + 1;
  }
  return result;
}

function replaceTitle(head: string, title: string): string {
  const open = '<title>';
  const close = '</title>';
  const start = head.indexOf(open);
  if (start === -1) {
    return `${head}\n    <title>${escapeText(title)}</title>`;
  }
  const contentStart = start + open.length;
  const end = head.indexOf(close, contentStart);
  if (end === -1) {
    return head;
  }
  return `${head.slice(0, contentStart)}${escapeText(title)}${head.slice(end)}`;
}

function headInner(html: string): { before: string; inner: string; after: string } {
  const open = '<head>';
  const close = '</head>';
  const start = html.indexOf(open);
  const end = html.indexOf(close);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('route shell HTML is missing <head>');
  }
  const innerStart = start + open.length;
  return {
    before: html.slice(0, innerStart),
    inner: html.slice(innerStart, end),
    after: html.slice(end),
  };
}

function isRobots(raw: string): boolean {
  return tagName(raw) === 'meta' && attr(raw, 'name') === 'robots';
}

function isCanonical(raw: string): boolean {
  return tagName(raw) === 'link' && attr(raw, 'rel') === 'canonical';
}

function isOgUrl(raw: string): boolean {
  return tagName(raw) === 'meta' && attr(raw, 'property') === 'og:url';
}

export function applyHtmlShell(html: string, head: HtmlShellHead): string {
  const parts = headInner(html);
  let inner = replaceTitle(parts.inner, head.title);
  if (head.canonical === null) {
    inner = removeTags(inner, (raw) => isCanonical(raw) || isOgUrl(raw));
  }
  if (head.robots === null) {
    inner = removeTags(inner, isRobots);
  }
  inner = mapTags(inner, (raw) => {
    const name = tagName(raw);
    if (name === 'meta' && attr(raw, 'name') === 'description') {
      return setQuotedAttr(raw, 'content', head.description);
    }
    if (name === 'meta' && attr(raw, 'name') === 'twitter:title') {
      return setQuotedAttr(raw, 'content', head.title);
    }
    if (name === 'meta' && attr(raw, 'name') === 'twitter:description') {
      return setQuotedAttr(raw, 'content', head.description);
    }
    if (name === 'meta' && attr(raw, 'name') === 'twitter:image' && head.image !== undefined) {
      return setQuotedAttr(raw, 'content', head.image);
    }
    if (name === 'meta' && attr(raw, 'name') === 'robots' && head.robots) {
      return setQuotedAttr(raw, 'content', head.robots);
    }
    if (name === 'meta' && attr(raw, 'property') === 'og:title') {
      return setQuotedAttr(raw, 'content', head.title);
    }
    if (name === 'meta' && attr(raw, 'property') === 'og:description') {
      return setQuotedAttr(raw, 'content', head.description);
    }
    if (name === 'meta' && attr(raw, 'property') === 'og:url' && head.canonical !== null) {
      return setQuotedAttr(raw, 'content', head.canonical);
    }
    if (name === 'meta' && attr(raw, 'property') === 'og:image' && head.image !== undefined) {
      return setQuotedAttr(raw, 'content', head.image);
    }
    if (
      name === 'meta' &&
      attr(raw, 'property') === 'og:image:alt' &&
      head.imageAlt !== undefined
    ) {
      return setQuotedAttr(raw, 'content', head.imageAlt);
    }
    if (name === 'link' && attr(raw, 'rel') === 'canonical' && head.canonical !== null) {
      return setQuotedAttr(raw, 'href', head.canonical);
    }
    return raw;
  });
  if (head.robots && !inner.includes('name="robots"')) {
    inner += `\n    <meta name="robots" content="${escapeAttr(head.robots)}" />`;
  }
  return `${parts.before}${inner}${parts.after}`;
}

export function readTitle(html: string): string | null {
  const open = '<title>';
  const close = '</title>';
  const start = html.indexOf(open);
  if (start === -1) {
    return null;
  }
  const contentStart = start + open.length;
  const end = html.indexOf(close, contentStart);
  if (end === -1) {
    return null;
  }
  return html.slice(contentStart, end);
}

export function readCanonicalHref(html: string): string | null {
  let found: string | null = null;
  mapTags(html, (raw) => {
    if (isCanonical(raw)) {
      found = attr(raw, 'href');
    }
    return raw;
  });
  return found;
}

export function readRobots(html: string): string | null {
  let found: string | null = null;
  mapTags(html, (raw) => {
    if (isRobots(raw)) {
      found = attr(raw, 'content');
    }
    return raw;
  });
  return found;
}

export function readMetaContent(
  html: string,
  kind: 'name' | 'property',
  key: string,
): string | null {
  let found: string | null = null;
  mapTags(html, (raw) => {
    if (tagName(raw) === 'meta' && attr(raw, kind) === key) {
      found = attr(raw, 'content');
    }
    return raw;
  });
  return found;
}

export function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const open = '<loc>';
  const close = '</loc>';
  let from = 0;
  while (from < xml.length) {
    const start = xml.indexOf(open, from);
    if (start === -1) {
      break;
    }
    const valueStart = start + open.length;
    const end = xml.indexOf(close, valueStart);
    if (end === -1) {
      break;
    }
    locs.push(xml.slice(valueStart, end).trim());
    from = end + close.length;
  }
  return locs;
}
