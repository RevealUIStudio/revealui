---
'@revealui/auth': patch
'@revealui/config': patch
'@revealui/utils': patch
---

Bump `zod` to `^4.4.3` (from `^4.3.6`) via the workspace catalog.

These packages declare `zod` as a `catalog:` runtime dependency, so the catalog bump changes their published dependency range. No source changes — `zod` 4.4.x is API-compatible for their usage (workspace `typecheck:all` and per-package tests green).
