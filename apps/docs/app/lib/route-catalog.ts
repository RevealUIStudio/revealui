/**
 * Public docs routes that receive an HTML shell at build time.
 * Path rules follow the live router: slug URLs, API README directories,
 * Pro package pages, and the showcase registry.
 */

import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsSourceDir, walkPublicDocs } from '../../scripts/docs-publish.mjs';
import {
  type DocsRouteShell,
  docsDocumentTitle,
  docsShell,
  routePathForDoc,
  titleFromMarkdown,
} from './route-paths';
import { DEFAULT_DESCRIPTION, SITE_TITLE } from './site-copy';

export type { DocsRouteShell };
export { docsDocumentTitle, routePathForDoc, titleFromMarkdown };

const DOCS_APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function humanSlug(slug: string): string {
  const words = slug.split('-').filter((part) => part.length > 0);
  return words
    .map((word) => {
      const first = word[0];
      if (!first) {
        return word;
      }
      return `${first.toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function readShowcaseNames(source: string): Array<{ slug: string; name: string }> {
  const entries: Array<{ slug: string; name: string }> = [];
  let slug = '';
  let name = '';
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith("slug: '") && trimmed.endsWith("',")) {
      slug = trimmed.slice("slug: '".length, -2);
    }
    if (trimmed.startsWith("name: '") && trimmed.endsWith("',")) {
      name = trimmed.slice("name: '".length, -2);
    }
    if (slug !== '' && name !== '') {
      entries.push({ slug, name });
      slug = '';
      name = '';
    }
  }
  return entries;
}

async function addProPages(byPath: Map<string, DocsRouteShell>): Promise<void> {
  const root = path.join(DOCS_APP_ROOT, 'public/docs-pro');

  async function walk(dir: string, prefix: string): Promise<void> {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }
      const abs = path.join(dir, entry.name);
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!entry.name.endsWith('.md')) {
        continue;
      }
      let routePath: string | null = null;
      if (rel === 'index.md') {
        routePath = '/pro';
      } else if (rel.endsWith('/index.md')) {
        routePath = `/pro/${rel.slice(0, -'/index.md'.length)}`;
      } else {
        routePath = `/pro/${rel.slice(0, -3)}`;
      }
      if (byPath.has(routePath)) {
        continue;
      }
      const content = await readFile(abs, 'utf8');
      const page = titleFromMarkdown(content, humanSlug(routePath.slice('/pro/'.length)));
      byPath.set(routePath, docsShell(routePath, docsDocumentTitle(page.title), page.description));
    }
  }

  await walk(root, '');
}

async function addShowcase(byPath: Map<string, DocsRouteShell>): Promise<void> {
  const overview =
    'Interactive explorer for RevealUI presentation components, props, and variants.';
  byPath.set(
    '/showcase',
    docsShell('/showcase', docsDocumentTitle('Component Showcase'), overview),
  );
  byPath.set(
    '/showcase/tokens',
    docsShell(
      '/showcase/tokens',
      docsDocumentTitle('Design Tokens'),
      'Color, spacing, typography, radius, shadow, and motion tokens for RevealUI.',
    ),
  );
  const registry = await readFile(
    path.join(DOCS_APP_ROOT, 'app/components/showcase/registry.ts'),
    'utf8',
  );
  for (const entry of readShowcaseNames(registry)) {
    const routePath = `/showcase/${entry.slug}`;
    byPath.set(
      routePath,
      docsShell(
        routePath,
        docsDocumentTitle(entry.name),
        `${entry.name} in the RevealUI component showcase.`,
      ),
    );
  }
}

export async function collectDocsRouteShells(): Promise<DocsRouteShell[]> {
  const byPath = new Map<string, DocsRouteShell>();
  byPath.set('/', docsShell('/', SITE_TITLE, DEFAULT_DESCRIPTION));

  const docsSource = docsSourceDir(DOCS_APP_ROOT);
  for await (const doc of walkPublicDocs(docsSource)) {
    const routePath = routePathForDoc(doc.rel);
    if (routePath === null || byPath.has(routePath)) {
      continue;
    }
    const page = titleFromMarkdown(doc.content, routePath.slice(1));
    byPath.set(routePath, docsShell(routePath, docsDocumentTitle(page.title), page.description));
  }

  await addProPages(byPath);
  await addShowcase(byPath);
  return [...byPath.values()];
}
