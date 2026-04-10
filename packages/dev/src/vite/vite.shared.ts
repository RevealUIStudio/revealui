/**
 * Shared Vite Configuration for RevealUI Framework
 *
 * This config provides common Vite settings used across RevealUI apps and packages.
 * Import and extend this config in your vite.config.ts files.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'vite'
 * import sharedViteConfig from '@revealui/dev/vite'
 *
 * export default defineConfig({
 *   ...sharedViteConfig,
 *   // Your app-specific config
 * })
 * ```
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate paths relative to this file's location (packages/dev/src/vite/)
const packagesRoot = path.resolve(__dirname, '../../..'); // packages/
const projectRoot = path.resolve(__dirname, '../../../..'); // RevealUI/

// Vite 7 adds oxc + rolldownOptions properties not yet in @types — cast to UserConfig
const sharedViteConfig = {
  oxc: {
    sourcemap: true,
  },
  ssr: {
    noExternal: ['revealui', 'sharp', 'react-animate-height'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    emptyOutDir: true,
    ssrManifest: true,
    outDir: './dist',
    rolldownOptions: {
      external: [
        'fs',
        'node:fs',
        'path',
        'os',
        'crypto',
        'util',
        'assert',
        'events',
        'url',
        'resolve',
        'http',
        'https',
        'zlib',
        'tty',
        'module',
        'child_process',
        'worker_threads',
        'stream',
        'process',
      ],
    },
  },
  resolve: {
    alias: {
      'node:fs': 'fs',
      // admin config alias
      '@reveal-config': path.resolve(projectRoot, 'apps/admin/revealui.config.ts'),
      // Package aliases
      '@revealui/core': path.resolve(packagesRoot, 'core/src'),
      '@revealui/contracts': path.resolve(packagesRoot, 'contracts/src'),
      '@revealui/db': path.resolve(packagesRoot, 'db/src'),
    },
  },
  define: {
    'import.meta.env.REVEALUI_PUBLIC_SERVER_URL': JSON.stringify(
      process.env.REVEALUI_PUBLIC_SERVER_URL ?? '',
    ),
  },
  optimizeDeps: {
    exclude: [],
  },
};

export default sharedViteConfig as UserConfig;
