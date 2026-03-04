import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Disable Vite's static-file-copy step — we manage public/ ourselves
  publicDir: false,
  build: {
    // Output to public/ — Vercel serves this as the static asset root
    outDir: 'public',
    // Don't wipe public/ (contains favicon, fonts, etc.)
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/client.tsx',
      output: {
        // Predictable filenames so the SSR template can reference them by name
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
