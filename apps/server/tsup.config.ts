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
  noExternal: [/^@revealui\/(?!ai($|\/)|services($|\/)|mcp($|\/))/],
  // pg is a CJS package better served as an external import  -  Node.js CJS interop
  // handles its require() of built-ins (events, net, etc.) natively.
  // @revealui/ai and @revealui/services are optional Pro packages  -  keep external
  // so builds succeed without them installed.
  // @revealui/mcp joined the external list with the GAP-406 hypervisor wire:
  // bundling it inlines @revealui/knowledge-graph's extractors and with them
  // the whole CJS TypeScript compiler, whose module-load init references
  // __filename — a ReferenceError in an ESM chunk (dist boots dead; caught
  // only by the E2E smoke job, 2026-07-25 promotion). External, Node loads
  // the CJS chain natively from node_modules like the other Pro packages.
  external: ['pg', 'pg-native', 'stripe', '@revealui/ai', '@revealui/services', '@revealui/mcp'],
  // Prefer package.json "node" export condition for deps such as @lexical/code
  // (LexicalCode.node.mjs). Without this, esbuild picks the default/browser
  // chain through @lexical/code-prism which assigns Prism.languages.* against
  // a missing global and kills `node dist/index.js` at import time
  // (E2E Smoke on promote PRs, 2026-08-02).
  esbuildOptions(options) {
    options.conditions = ['node', 'import', 'module', 'default'];
  },
  // OG fonts + resvg WASM are read at runtime from dist (copy-og-fonts /
  // copy-resvg-wasm). Do NOT binary-inline .ttf — that worked only in the
  // built bundle and broke `tsx watch` with ERR_UNKNOWN_FILE_EXTENSION
  // (GAP-401). CJS packages bundled via the @revealui/* chain still call
  // require() of Node built-ins; this banner keeps those calls working on
  // serverless platforms. Because the banner declares `createRequire` +
  // `const require` in every chunk, app source must NEVER import
  // createRequire itself (duplicate-identifier SyntaxError in the built
  // bundle) — use import.meta.resolve instead, as index.ts (swagger-ui
  // assets) and lib/mcp-hypervisor-wire.ts do.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
