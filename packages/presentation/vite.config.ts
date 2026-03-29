import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
      copyDtsFiles: true,
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, 'src/index.ts'),
        server: path.resolve(import.meta.dirname, 'src/server.ts'),
        client: path.resolve(import.meta.dirname, 'src/client.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        entryFileNames: '[name].js',
        banner: (chunk) => {
          // Add 'use client' directive to bundles that contain client components.
          // The 'server' bundle is the only one safe for RSC — index re-exports client components.
          if (chunk.name === 'client' || chunk.name === 'index') {
            return '"use client";';
          }
          return '';
        },
      },
    },
    sourcemap: true,
    // Faster builds in dev
    minify: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
