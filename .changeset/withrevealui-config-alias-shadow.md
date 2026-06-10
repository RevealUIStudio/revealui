---
'@revealui/core': patch
---

withRevealUI no longer aliases the `@revealui/config` package specifier to the app's `revealui.config.ts` (webpack + Turbopack). The alias shadowed the real env-config package inside Next.js server bundles, so `config.reveal` / `config.database` reads resolved against the CMS instance config and returned `undefined` at runtime (prod admin passkey/MFA/sign-in 500s). CMS config loading is unaffected: apps import `revealui.config.ts` relatively or via their own `@reveal-config` alias. The webpack-only "config file not found" build validation tied to the alias is removed with it; a missing config file still fails the build at the app's own import site.
