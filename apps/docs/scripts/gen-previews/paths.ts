import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** apps/docs */
export const docsRoot = path.resolve(here, '../..');

/** repo root (monorepo top) */
export const repoRoot = path.resolve(docsRoot, '../..');

/** @revealui/presentation package root */
export const presentationRoot = path.resolve(repoRoot, 'packages/presentation');

/**
 * Authoritative component surface: the source component barrel. Imported for
 * its export NAMES only (never rendered from — see render.tsx, which renders
 * from the built dist barrel to share the workspace React instance).
 */
export const componentSourceBarrel = path.join(presentationRoot, 'src/components/index.ts');

/** Built barrel used for actual rendering (bundled against the hoisted React). */
export const distBarrel = path.join(presentationRoot, 'dist/index.js');

/** Docs Tailwind v4 entry (token bridge + @source globs) reused to compile CSS. */
export const docsIndexCss = path.join(docsRoot, 'app/index.css');

/** Docs showcase registry (curated example source, reused). */
export const showcaseRegistry = path.join(docsRoot, 'app/components/showcase/registry.ts');

/** Default output bundle root. */
export const defaultOutDir = path.join(repoRoot, 'preview-dist');
