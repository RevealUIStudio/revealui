---
'@revealui/security': minor
'@revealui/core': patch
---

Add a client-safe `@revealui/security/sanitize` subpath and route rich-text RSC rendering through it — fixes a `node:crypto` client-bundle crash.

`@revealui/core/richtext/rsc` imported `isSafeUrl` / `sanitizeUrl` from the `@revealui/security` barrel, which statically re-exports `auth.ts` and `gdpr.ts`. Both modules have a top-level `import { ... } from 'node:crypto'`, so the entire crypto graph was pulled into every client/RSC bundle that rendered rich text. In the browser `node:crypto` is unavailable, which crashed the bundle and blanked any route loading rich-text content (e.g. the marketing `/blog` route, on `main`/production).

- `@revealui/security`: new `./sanitize` export (built as a separate tsup entry). It bundles only `src/sanitize.ts` + `parse5` — no `node:crypto` — so it is safe to import from a browser/RSC client path. The barrel is unchanged for server consumers.
- `@revealui/core`: `richtext/exports/server/rsc.tsx` now imports the URL helpers from `@revealui/security/sanitize` instead of the barrel. No public API change; existing re-exports of `isSafeUrl` / `sanitizeUrl` are preserved.

The sync `totpHmac` (TOTP) usage in `auth.ts` is intentionally left as a static import — converting it to a lazy `await import('node:crypto')` would force an async signature change rippling to all TOTP callers. Isolating the client path via the subpath avoids that blast radius entirely.
