import { defineConfig } from 'tsup';

export default defineConfig({
  // The default barrel (src/index.ts) is client-bundle-safe: it re-exports only
  // modules free of `node:` built-ins. Server-only modules that pull node:crypto
  // (auth/gdpr/audit) or node:dns (ssrf) are isolated in src/server.ts behind the
  // ./server subpath. src/sanitize.ts is the minimal client-safe surface for
  // URL/HTML helpers (parse5 only). Separate entries mean a browser/RSC bundle
  // importing '.' or './sanitize' never drags the node: graph in (the crash
  // class fixed by #1046). Node-only functionality stays behind explicit
  // './server' and './review-receipt' subpaths.
  entry: [
    'src/index.ts',
    'src/server.ts',
    'src/sanitize.ts',
    'src/cookie-consent.ts',
    'src/review-receipt.ts',
    'src/security-path-classifier.ts',
  ],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
});
