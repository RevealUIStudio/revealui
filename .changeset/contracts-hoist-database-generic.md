---
'@revealui/contracts': patch
---

Hoist the verbatim-duplicate `Database<T>` generic out of `database/bridge.ts` and `database/type-bridge.ts` into a new shared module `database/types.ts`. Both files now `import type` + re-export from the canonical location, eliminating ~50 lines of duplication. Public API is unchanged: `import { Database } from '@revealui/contracts/database/bridge'` (or `/type-bridge`) still works because both modules re-export the type. Closes GAP-136 Phase 1. Phase 2 (renaming the unrelated concrete `interface Database` in `generated/database.ts` to disambiguate) is intentionally deferred — that file is auto-generated and a rename needs generator-tooling investigation; tracked separately if/when prioritized.
