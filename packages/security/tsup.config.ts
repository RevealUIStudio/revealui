import { defineConfig } from 'tsup';

export default defineConfig({
  // src/sanitize.ts is built as a separate, client-safe entry: it imports only
  // parse5 (no node:crypto), so consumers in a browser/RSC client bundle (e.g.
  // @revealui/core/richtext/rsc) can pull isSafeUrl/sanitizeUrl via the
  // ./sanitize subpath WITHOUT dragging in auth.ts/gdpr.ts top-level node:crypto
  // imports through the barrel (which crashes the client bundle).
  entry: ['src/index.ts', 'src/sanitize.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
});
