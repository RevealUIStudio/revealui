import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  bundle: true,
  dts: false,
  sourcemap: true,
  outDir: 'dist',
  // Bundle workspace packages so extensionless ESM imports are resolved at build
  // time rather than failing at runtime in Node.js strict ESM mode.
  // Third-party packages are left external (they use proper .js extensions).
  noExternal: [/^@revealui\/(?!ai($|\/))/],
  // pg is a CJS package better served as an external import — Node.js CJS interop
  // handles its require() of built-ins (events, net, etc.) natively.
  // @revealui/ai is an optional Pro package — keep external so builds succeed without it.
  external: ['pg', 'pg-native', 'stripe', '@revealui/ai'],
  // CJS packages bundled via the @revealui/* chain (e.g. dotenv) call require()
  // of Node.js built-ins like 'fs' and 'path'. In ESM bundles, require() is
  // undefined and esbuild's CJS shim throws. This banner injects createRequire
  // so those calls succeed at runtime on all Node.js serverless platforms.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
})
