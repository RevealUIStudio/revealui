---
"@revealui/db": minor
"@revealui/contracts": minor
---

add the `nudge_dismissals` table and its generated contract: server-tracked per-user, per-nudge dismissal state (snooze count + last-dismissed timestamp) backing the per-tier onboarding nudge surface. New schema surface in `@revealui/db` (`packages/db/src/schema/nudges.ts`, registered in `rest.ts` and the database types) and the matching additive entries in `@revealui/contracts` generated schemas.
