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
  noExternal: [/^@revealui\//],
  // pg is a CJS package that transitively calls require('events'). When bundled
  // into ESM via the @revealui/* chain, esbuild's CJS shim can't require() Node
  // built-ins. Keeping pg external lets Node.js CJS interop handle it natively.
  external: ['pg', 'pg-native'],
})
