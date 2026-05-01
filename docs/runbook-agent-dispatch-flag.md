# Runbook — `REVEALUI_JOBS_AGENT_DISPATCH_ENABLED` flag

## What the flag does

When `REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true`, the
`POST /api/agent-tasks` and `POST /api/agent-tasks/:ticketId/dispatch`
endpoints route through the durable work queue
(CR8-P2-01 phase C):

1. The route enqueues an `agent.dispatch` job and polls the job row
   for up to 22 seconds.
2. If the dispatch completes within the poll window, the route
   returns **200** with the same response shape as the legacy sync
   path (callers see no behavior change).
3. If the poll window elapses, the route returns **202** with
   `jobId` and `statusUrl` so the caller can poll
   `GET /api/agent-tasks/:ticketId/status`.

When the flag is **unset** or **`false`**, both endpoints behave
exactly as they did before phase C: synchronous dispatch with an
in-process `setTimeout` budget. A pod crash mid-dispatch silently
loses the work — that's the durability gap phase C exists to close.

## Flipping the flag on

### Prerequisites

- `REVEALUI_JOBS_WAKE_SECRET` is set (≥ 32 random bytes).  
  Without it, the producer's wake fan-out is a no-op and every
  dispatch waits up to 24 h for the cron safety-net. **The API
  refuses to start with the flag on and the wake secret unset** —
  fail fast at boot via `assertDispatchFlagConfigured()`.
- `REVEALUI_INTERNAL_BASE_URL` is set when the API and worker
  invocations resolve each other via something other than
  `http://localhost:3004`. In Vercel prod, point this at the API's
  public URL.
- The `agent.dispatch` handler is registered at boot (handled
  automatically by the side-effect import in
  `apps/server/src/index.ts`).

### Procedure

1. **Confirm both env vars are set in the target environment**
   (Vercel preview / prod). Pull from revvault:
   `revvault get revealui/prod/jobs/wake-secret`.
2. Set `REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true` in the
   environment's variable pane.
3. Redeploy. The boot assertion runs on the first request after
   deploy; if either variable is missing the function will throw
   loudly in the logs.
4. Smoke test: `curl -X POST /api/agent-tasks/<known-ticket>/dispatch`
   and confirm the response is **200** within ~22 s for a small
   prompt, or **202** with a `statusUrl` for a long one.
5. Monitor `[agent.dispatch]` log lines:
   - `claimed` — worker picked up the job
   - `llm.start` / `llm.done` — dispatcher ran (with timing)
   - `replayed-from-cache` — crash-resume hit the memoized result
   - `[jobs.run] handler failed` — handler threw; check
     `lastError` in `jobs` table

## Flipping the flag off (rollback)

Set `REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=false` (or unset it)
and redeploy. The route immediately reverts to the legacy sync
path. **In-flight queued jobs continue to drain** — the worker
keeps pulling them, completing them, and writing results to the
ticket. New dispatches use the sync path until the flag flips
back on.

There is no destructive cleanup required. Rollback is safe at
any point.

## Per-tenant rollout (future)

Phase C ships the global env flag only. A future enhancement can
gate per-tenant via `account_entitlements.limits.durableDispatch`.
The handler already accepts a `tenantId` in its payload, so the
plumbing is in place — only a check inside `isDurableDispatchEnabled()`
needs to consult the entitlement row.

## Failure modes and recovery

| Symptom | Likely cause | Recovery |
|---|---|---|
| API refuses to start, log mentions `REVEALUI_JOBS_WAKE_SECRET` | Flag on, secret missing | Set the secret OR flip flag off |
| Dispatch returns 202 but `/status` stays `pending` for hours | Wake secret mismatch (worker rejecting wakes); cron safety-net is the floor | Verify both `REVEALUI_JOBS_WAKE_SECRET` values match. If still stuck, check the worker route logs at `/api/jobs/run` for 401s. |
| `/status` returns `failed` with `lastError: "stalled: claim expired before completion"` | Worker crashed mid-dispatch; cron safety-net reclaimed | Job retries automatically with backoff. Check the next attempt's logs. |
| `/status` returns `failed` with `lastError: "AI feature unavailable at dispatch time"` | License revoked between enqueue and claim | Restore the license; manually re-enqueue. |
| Duplicate comments on a ticket | Crash mid-dispatch BEFORE the LLM idempotency key was written | Pre-existing limitation: the LLM call boundary is the memoization point; tool calls inside the agent loop use deterministic ids ([revealui#477](https://github.com/RevealUIStudio/revealui/pull/477)) but a crash mid-loop and a successful retry can still produce a small number of extra rows. File a follow-up tracker if frequency exceeds noise. |

## Related infrastructure

- Phase A — queue primitive: `packages/db/src/jobs/`,
  `apps/server/src/routes/jobs/run.ts`
- Phase B — cron safety-net: `apps/server/src/routes/cron/jobs-safety-net.ts`
- Design doc: `~/suite/.jv/docs/CR8-P2-01-native-queue-design.md`
- Flag-removal follow-up: filed at PR-merge time, scheduled
  ≥ 2 weeks of clean prod operation before removal.
