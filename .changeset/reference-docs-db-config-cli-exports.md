---
'@revealui/db': minor
'@revealui/config': minor
'@revealui/cli': minor
---

Expose previously-documented APIs that weren't actually on the public surface:

**`@revealui/db` — 8 new schema subpath exports** (source + dist existed; only the exports map was missing):
- `./schema/password-reset-tokens`
- `./schema/admin` (`posts`, `media`, `globalHeader`, `globalFooter`, `globalSettings`)
- `./schema/licenses`
- `./schema/api-keys` (`userApiKeys`, `tenantProviderConfigs`)
- `./schema/audit-log`
- `./schema/app-logs`
- `./schema/error-events`

**`@revealui/config` — 4 re-exports from the package root:**
- `validateAndThrow` — already in `./validator.js`, now on the root barrel
- `getDatabaseConfig` / `getRevealConfig` / `getStripeConfig` — from `./modules/{database,reveal,stripe}.js`

**`@revealui/cli` — programmatic project creation:**
- `createProject` and `CreateProjectConfig` are now exported from the package root for use in tests and custom tooling (documented in `docs/REFERENCE.md`).

No behavior changes — purely surface-area additions. Drops docs-import-drift findings in REFERENCE.md by 19 (21 → 2; the remaining 2 are `@revealui/core/api/rate-limit` which the companion PR handles).
