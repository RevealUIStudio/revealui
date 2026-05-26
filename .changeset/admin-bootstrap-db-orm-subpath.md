---
'@revealui/db': minor
---

Add `@revealui/db/orm` subpath that re-exports Drizzle ORM query helpers (`eq`, `and`, `or`, `sql`, `inArray`, `desc`, `count`, ...).

Worker scripts and apps should depend on Drizzle through this subpath instead of importing the bare `drizzle-orm` package. Under pnpm's isolated linker, `drizzle-orm` is materialized only inside the `node_modules` of packages that declare it (such as `@revealui/db`), not at the repo root — so a bare `import('drizzle-orm')` from repo-root `scripts/` fails with `ERR_MODULE_NOT_FOUND`. Importing through `@revealui/db/orm` resolves from any workspace location and guarantees the operators come from the same Drizzle instance as the db client and schema.
