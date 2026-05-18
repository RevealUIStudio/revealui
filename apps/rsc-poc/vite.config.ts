import rsc from '@vitejs/plugin-rsc';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    rsc({
      entries: {
        rsc: './src/entry.rsc.tsx',
        ssr: './src/entry.ssr.tsx',
        client: './src/entry.browser.tsx',
      },
    }),
    react(),
  ],
});
