import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
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
  // Inline Geist TTFs into the bundle for satori. The resvg WASM is NOT
  // inlined — it's read at runtime from node_modules via createRequire
  // (see apps/api/src/routes/og.ts). The earlier inline approach via
  // tsup's binary loader worked in Vercel Edge / CF Workers but crashes
  // Node's experimental WASM ESM loader (the .wasm's import section
  // declares a `wbg` import that has no resolution path when the .wasm
  // is loaded as an ES module).
  loader: {
    '.ttf': 'binary',
  },
  // CJS packages bundled via the @revealui/* chain (e.g. dotenv) call require()
  // of Node.js built-ins like 'fs' and 'path'. In ESM bundles, require() is
  // undefined and esbuild's CJS shim throws. This banner injects createRequire
  // so those calls succeed at runtime on all Node.js serverless platforms.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
