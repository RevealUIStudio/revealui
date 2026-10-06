import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { writeMarketingShells } from './app/lib/write-marketing-shells';

function marketingShellsPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'marketing-route-shells',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await writeMarketingShells(outDir);
    },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), react(), marketingShellsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    // Not a secret. Lets one SENTRY_ENVIRONMENT=staging value on the Vercel
    // marketing project reach the browser SDK.
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(
      process.env.VITE_SENTRY_ENVIRONMENT || process.env.SENTRY_ENVIRONMENT || '',
    ),
  },
});
