import { defineConfig } from 'tsup';

export default defineConfig({
  // The default barrel (src/index.ts) is client-bundle-safe: it re-exports only
  // modules free of `node:` built-ins. Server-only modules that pull node:crypto
  // (auth/gdpr/audit) or node:dns (ssrf) are isolated in src/server.ts behind the
  // ./server subpath. src/sanitize.ts is the minimal client-safe surface for
  // URL/HTML helpers (parse5 only). Separate entries mean a browser/RSC bundle
  // importing '.' or './sanitize' never drags the node: graph in (the crash
  // class fixed by #1046); '@revealui/security/server' is the only node:-bearing
  // entry.
  entry: ['src/index.ts', 'src/server.ts', 'src/sanitize.ts', 'src/cookie-consent.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
});
