import { defineConfig } from 'vite';

export default defineConfig({
  // server: {
  //     port: 3000,
  // },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    // Add your Vite plugins here
  ],
});
