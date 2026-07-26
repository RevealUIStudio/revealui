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
  // ESM chunk. @revealui/security has no such transitive-CJS hazard and is
  // small, so it is bundled inline (tsup default) to keep the Apify actor's
  // runtime node_modules footprint minimal.
  external: ['apify', '@revealui/ai'],
});
