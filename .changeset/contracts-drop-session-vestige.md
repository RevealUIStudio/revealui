---
'@revealui/contracts': patch
---

Drop the vestigial `SessionSchema` / `Session` type / `createSession` helper from `packages/contracts/src/entities/user.ts`. They were the older ISO-string shape (predating `entities/session.ts`), still re-exported at top level even though every `import { Session } from '@revealui/contracts'` consumer was zero (verified). Top-level `@revealui/contracts` now redirects `Session` and `SessionSchema` to the comprehensive Date-typed shape from `entities/session.ts` (which the entities barrel already pointed at). Also removes the orphan `SESSION_SCHEMA_VERSION` constant from `user.ts` and its `USER_SESSION_SCHEMA_VERSION` alias re-export from `entities/index.ts` (the canonical `SESSION_SCHEMA_VERSION` lives in `entities/session.ts`). Closes GAP-134.
