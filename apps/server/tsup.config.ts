import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/worker.ts'],
  format: ['esm'],
  platform: 'node',
  bundle: true,
  dts: false,
  sourcemap: false,
  outDir: 'dist',
  // Bundle workspace packages so extensionless ESM imports are resolved at build
  // time rather than failing at runtime in Node.js strict ESM mode.
  // Third-party packages are left external (they use proper .js extensions).
  noExternal: [/^@revealui\/(?!ai($|\/)|services($|\/))/],
  // pg is a CJS package better served as an external import  -  Node.js CJS interop
  // handles its require() of built-ins (events, net, etc.) natively.
  // @revealui/ai and @revealui/services are optional Pro packages  -  keep external
  // so builds succeed without them installed.
  external: ['pg', 'pg-native', 'stripe', '@revealui/ai', '@revealui/services'],
  // OG fonts + resvg WASM are read at runtime from dist (copy-og-fonts /
  // copy-resvg-wasm). Do NOT binary-inline .ttf — that worked only in the
  // built bundle and broke `tsx watch` with ERR_UNKNOWN_FILE_EXTENSION
  // (GAP-401). CJS packages bundled via the @revealui/* chain still call
  // require() of Node built-ins; this banner keeps those calls working on
  // serverless platforms. index.ts also uses createRequire explicitly for
  // swagger-ui-dist so tsx and tsup share one code path.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
