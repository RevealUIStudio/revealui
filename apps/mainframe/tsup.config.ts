import { defineConfig } from 'tsup'

export default defineConfig({
  // Named entry so tsup outputs dist/index.js (matches api/index.js import path)
  entry: { index: 'src/app.ts' },
  format: ['esm'],
  platform: 'node',
  bundle: true,
  dts: false,
  sourcemap: false,
  outDir: 'dist',
  // Bundle workspace packages so extensionless ESM imports resolve at build time.
  noExternal: [/^@revealui\//],
  // CJS packages bundled via the @revealui/* chain may call require() of Node.js
  // built-ins. This banner injects createRequire so those calls succeed at runtime.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
})
