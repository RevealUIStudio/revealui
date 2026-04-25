---
'api': patch
---

Add application-level seat-count guard for `accountMemberships` inserts (partial closure of #397 / CR8-P2-03).

The `maxUsers` cap per hosted tier (pro=25, max=100, enterprise=unlimited) was defined but never enforced on `accountMemberships` inserts. A Pro team could silently add 200 active members with no rejection. Issue #397 calls for both application-level pre-insert check and DB-level defense-in-depth.

This PR ships the application-level half:

- **`apps/api/src/lib/seat-count-guard.ts`** — exports `SeatLimitReachedError` (with structured `{ code: 'seat_limit_reached', accountId, current, max }` fields for 402 responses) and `assertSeatAvailable(db, accountId, maxUsers)`. Returns early when `maxUsers` is null/undefined (enterprise); throws the structured error when the active-member count meets or exceeds the cap.
- **8 unit tests** covering all three branches (unlimited no-op, under-cap resolve, at-or-over-cap throw) + structured-error-field assertions + edge cases (empty count result, maxUsers=0 literal cap).

Not in this PR (deferred follow-ups so the shipped piece is reviewable in isolation):

- **Integration at call sites.** Currently the only `accountMemberships` insert is the bootstrap owner-insert in `webhooks.ts:376` (always count=0, always passes trivially — not a meaningful demonstration). The guard will be wired by whichever PR adds the team-invite flow.
- **DB-level trigger defense-in-depth.** Needs a drizzle-kit-generated migration per the 2026-04-19 journal discipline (see CR9 / migration-discipline docs). Separate PR.
- **`apps/api/src/lib/tier-limits.ts` extraction.** Planned move of `getHostedLimitsForTier` out of `webhooks.ts` into a shared module; the guard takes `maxUsers` as a parameter so the extraction isn't a blocker. Deferred to reduce contention with in-flight edits on `webhooks.ts`.
- **Admin UI seat counter + invite-flow preview.** Product-surface work for the admin app, separate from the API enforcement.

The guard is exported and ready to wire; no behavior change until a caller invokes it.
