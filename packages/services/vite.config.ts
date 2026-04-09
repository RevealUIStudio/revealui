import path from 'node:path';
import react from '@vitejs/plugin-react';
import sharedViteConfig from '@revealui/dev/vite';
import { defineConfig, loadEnv } from 'vite';

const { VITE_API_URL, VITE_REVALIDATION_KEY } = loadEnv('', import.meta.dirname);
const API_URL = VITE_API_URL || process.env.API_URL;
const REVALIDATION_KEY = VITE_REVALIDATION_KEY || process.env.REVALIDATION_KEY;

const viteConfig = defineConfig({
  ...sharedViteConfig,
  plugins: [react()],
  ssr: {
    noExternal: ['sharp', 'react-animate-height'],
  },
  oxc: {
    sourcemap: true,
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      external: [
        'fs',
        'react/jsx-runtime',
        'node:fs',
        'path',
        'os',
        'crypto',
        'util',
        'assert',
        'events',
        'node:url',
        'resolve',
        'http',
        'https',
        'zlib',
        'tty',
        'module',
        'child_process',
        'worker_threads',
        'stream',
        'import.meta',
        'process',
      ],
    },
    emptyOutDir: true,
    ssrManifest: true,
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@reveal-config': path.resolve(import.meta.dirname, '../../apps/admin/revealui.config.ts'),
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.API_URL),
    'import.meta.env.VITE_REVALIDATION_KEY': JSON.stringify(process.env.REVALIDATION_KEY),
    'import.meta.env.API_URL': JSON.stringify(API_URL),
    'import.meta.env.REVALIDATION_KEY': JSON.stringify(REVALIDATION_KEY),
  },
});

export default viteConfig;
