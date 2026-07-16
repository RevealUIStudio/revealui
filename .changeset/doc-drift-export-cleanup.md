---
"@revealui/db": patch
"@revealui/auth": patch
---

remove dangling export subpaths that pointed at nonexistent source modules: `./schema/cms` in @revealui/db (no `src/schema/cms.ts`; `posts` lives in `schema/admin.ts`) and `./client` in @revealui/auth (no `src/client/` implementation). No consumer imports either subpath.
