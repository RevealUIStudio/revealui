---
'@revealui/core': minor
---

Expose `./database/type-adapter` as a public subpath (source + dist already existed; only the exports map was missing). Unblocks `dbRowToContract` usage documented in `docs/ARCHITECTURE.md`.

Paired with doc-only fixes across 10 files (AI-AGENT-RULES, ARCHITECTURE, AUTOMATION, BUILD_YOUR_BUSINESS, CORE_STABILITY, LOCAL_FIRST, LOGGING, STANDARDS, TYPE-SYSTEM-RULES, agent-rules/database-boundaries) that correct stale `@revealui/*` import paths and replace placeholder-named samples (`MyEntity`, `ItemType`, `MyConfig`, `NewTableSelectSchema`) with real exported contract types (`Page`, `User`, `SiteSettings`, `PostsSelectSchema`).

Drops docs-import-drift findings by 22 (from 216 → 194 on `test`).

No behavior changes.
