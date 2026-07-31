import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core.ts',
    server: 'src/server.tsx',
    'server-ssr': 'src/server-ssr.tsx',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: [
    'react',
    'react-dom',
    'hono',
    '@hono/node-server',
    'node:async_hooks',
    'async_hooks',
    /^@revealui\//,
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
