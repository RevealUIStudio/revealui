import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        index: path.resolve(__dirname, 'src/index.ts'),
        server: path.resolve(__dirname, 'src/server.ts'),
        client: path.resolve(__dirname, 'src/client.ts'),
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
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
