import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/index.ts'],
  format: ['esm'],
  platform: 'node',
  bundle: true,
  dts: false,
  sourcemap: false,
  outDir: 'dist',
  // Third-party npm packages stay external (resolved from node_modules at
  // runtime, same as apps/server's tsup config). @revealui/ai is kept external
  // too, matching apps/server's proven config (apps/server/tsup.config.ts) --
  // bundling it has previously inlined CJS transitive deps that break in an
  // ESM chunk.
  //
  // Corrected 2026-07-26 (GAP-431 standalone packaging): tsup's default
  // behavior externalizes everything listed under package.json
  // "dependencies" automatically (this array only adds @revealui/ai, which
  // is an optionalDependency and so isn't auto-externalized). So
  // @revealui/security and zod are ALSO external in the compiled output --
  // verified by inspecting dist/chunk-*.js, which still `import`s both --
  // despite an earlier version of this comment claiming @revealui/security
  // gets bundled inline. It does not. The standalone actor build
  // (scripts/deploy/build-apify-actor-standalone.mjs) depends on this being
  // accurate: it declares @revealui/security, apify, and zod as real runtime
  // dependencies in the generated package.json.
  external: ['apify', '@revealui/ai', '@revealui/ai/llm/providers/base'],
});
