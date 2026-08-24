import fs from 'node:fs/promises';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import {
  cleanGeneratedPublicMirror,
  docsSourceDir,
  emitPublicDocsToDir,
  resolvePublicDoc,
} from './scripts/docs-publish.mjs';

/** Enable verbose docs-publish logging with DEBUG=docs-publish or DEBUG=* */
const debugTokens = new Set((process.env.DEBUG ?? '').split(',').map((token) => token.trim()));
const DEBUG =
  debugTokens.has('docs-publish') || debugTokens.has('*') || debugTokens.has('docs-copy');

function createMarkdownMiddleware(docsSource: string) {
  return async (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void,
  ): Promise<void> => {
    try {
      const url = req.url ?? '';
      const pathOnly = url.split('?')[0] ?? '';
      if (!(pathOnly.endsWith('.md') || pathOnly.endsWith('.mdx'))) {
        next();
        return;
      }
      // Hand-authored public/docs-pro/* stays on disk under public/.
      if (pathOnly === '/docs-pro' || pathOnly.startsWith('/docs-pro/')) {
        next();
        return;
      }
      const resolved = await resolvePublicDoc(docsSource, pathOnly);
      if (!resolved) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(resolved.content);
      if (DEBUG) console.log(`[docs-publish] serve ${resolved.rel}`);
    } catch (err) {
      console.error('[docs-publish] middleware error', err);
      res.statusCode = 500;
      res.end('docs-publish error');
    }
  };
}

/**
 * Docs publish plane (virtual serve).
 *
 * SoT is monorepo docs/. This plugin:
 *   1. Cleans any leftover generated markdown under apps/docs/public/ (except
 *      hand-authored docs-pro/) so static public/ never shadows the middleware.
 *   2. Dev: middleware serves visibility:public markdown from docs/ over HTTP.
 *   3. Build: emits the same set into Vite outDir (dist/) only — never into
 *      an authoring-shaped public/*.md mirror.
 *
 * Replaces the old docs-copy → public/ materialization (CHIP-3 D5a URLs unchanged).
 */
function docsPublishPlugin(): Plugin {
  const docsAppRoot = path.resolve(import.meta.dirname);
  const docsSource = docsSourceDir(docsAppRoot);
  const publicDir = path.resolve(docsAppRoot, 'public');
  let outDir = path.resolve(docsAppRoot, 'dist');

  return {
    name: 'docs-publish',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      const removed = await cleanGeneratedPublicMirror(publicDir, docsSource);
      if (DEBUG || removed > 0) {
        console.log(
          `[docs-publish] cleaned ${removed} leftover generated .md file(s) from public/`,
        );
      }
    },
    configureServer(server) {
      // Run early so we own .md before any accidental public/ static hit.
      // (Leftover mirrors are cleaned in buildStart; middleware is the SoT path.)
      server.middlewares.use(createMarkdownMiddleware(docsSource));

      // Watch monorepo docs/ so HMR-adjacent reloads pick up content changes.
      // (SPA caches markdown client-side; full reload still refetches.)
      server.watcher.add(path.join(docsSource, '**/*.{md,mdx}'));
    },
    configurePreviewServer(server) {
      // Same 404-for-missing-.md behavior as configureServer so `vite preview`
      // does not SPA-rewrite unknown markdown into index.html.
      server.middlewares.use(createMarkdownMiddleware(docsSource));
    },
    async writeBundle(options) {
      // Production: write public docs into dist/ so fetch('/ADMIN_GUIDE.md') works
      // on the static host. Does not write into apps/docs/public/.
      // writeBundle only runs after a successful bundle write (not on failed builds).
      const dest = options.dir ? path.resolve(options.dir) : outDir;
      try {
        await fs.mkdir(dest, { recursive: true });
        const count = await emitPublicDocsToDir(docsSource, dest);
        console.log(`[docs-publish] emitted ${count} public markdown file(s) → ${dest}`);
      } catch (err) {
        console.error('[docs-publish] emit to outDir failed', err);
        throw err;
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), docsPublishPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './app'),
    },
  },
  server: {
    port: 3002,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL ?? 'warn'),
  },
});
