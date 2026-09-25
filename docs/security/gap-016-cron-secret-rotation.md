---
title: "GAP-016 CRON_SECRET rotation"
description: "Zero-downtime overlap procedure for REVEALUI_CRON_SECRET and the Vercel CRON_SECRET bearer."
visibility: internal
status: verified
audience: maintainer
---

# GAP-016 — zero-downtime CRON_SECRET rotation

Accept the outgoing secret and the incoming secret for one deploy window, move every caller to the incoming secret, then drop the outgoing secret.

The owner generates the new value and writes it into the hosting environment (Vercel, Fly, GitHub Actions, revvault). This document does not generate a secret and does not contain a secret value. An agent following this runbook stops before any generate, `revvault set`, `vercel env`, or `gh secret set` command.

Linked from [`docs/CREDENTIAL-ROTATION-RUNBOOK.md`](../CREDENTIAL-ROTATION-RUNBOOK.md).

## Env vars the code accepts

There is no comma-separated accept-list. Each family is current value, plus one optional previous value.

| Env var | Role | Steady state |
|---------|------|----------------|
| `REVEALUI_CRON_SECRET` | Current secret for header `X-Cron-Secret` (either casing). Admin cron routes compare `Authorization: Bearer` to this same var. | Set. 32+ characters in hosted production. |
| `REVEALUI_CRON_SECRET_PREVIOUS` | Outgoing `X-Cron-Secret` / admin Bearer value. | Unset or empty. |
| `CRON_SECRET` | Vercel platform cron bearer. `GET /api/cron/dispatch` accepts `Authorization: Bearer <CRON_SECRET>`. `GET` and `POST /api/cron/uptime-check` accept that bearer, and also `X-Cron-Secret` matching `REVEALUI_CRON_SECRET`. | Set only if the api project already has it. |
| `CRON_SECRET_PREVIOUS` | Outgoing Vercel bearer. | Unset or empty. |

Comparisons are timing-safe and fail closed when the relevant pair is unset, with one pre-existing exception: `uptime-check` stays open only when `REVEALUI_CRON_SECRET`, `REVEALUI_CRON_SECRET_PREVIOUS`, `CRON_SECRET`, and `CRON_SECRET_PREVIOUS` are all unset. A 200 from that route proves a match only when one of those vars is set.

`/api/cron/dispatch` fans out to sub-jobs with `X-Cron-Secret` set to the **current** `REVEALUI_CRON_SECRET` only. Sub-jobs accept current or previous, so the fan-out keeps working through the window. Leave `REVEALUI_CRON_SECRET` set to the incoming value for the whole window.

When `METRICS_SECRET` is unset, `/metrics` falls back to `CRON_SECRET` and also accepts `CRON_SECRET_PREVIOUS`. When `METRICS_SECRET` is set, the cron bearer is not a metrics credential.

Startup rejects a set `REVEALUI_CRON_SECRET_PREVIOUS` or `CRON_SECRET_PREVIOUS` shorter than 32 characters in hosted mode (`apps/server/src/lib/validate-startup.ts`). `@revealui/config` applies the same 32-character minimum to `REVEALUI_CRON_SECRET_PREVIOUS`.

## Who sends which secret

| Caller | What it sends | Secret store |
|--------|----------------|--------------|
| Vercel cron `apps/server/vercel.json` → `GET /api/cron/dispatch` | `Authorization: Bearer` equal to the deployment's `CRON_SECRET` | Vercel api project env `CRON_SECRET` |
| GitHub Actions `.github/workflows/reconciliation-crons.yml` | `X-Cron-Secret` from `secrets.REVEALUI_CRON_SECRET` | GitHub Actions secret **named** `REVEALUI_CRON_SECRET` |
| GitHub Actions `.github/workflows/worker-liveness.yml` | same header, same GitHub secret, `POST /api/cron/worker-liveness` | same GitHub secret |
| Manual / runbook curls | `X-Cron-Secret: $REVEALUI_CRON_SECRET` | operator shell |
| Admin cron routes (`apps/admin`) | `Authorization: Bearer` checked against the **admin** process env `REVEALUI_CRON_SECRET` or `REVEALUI_CRON_SECRET_PREVIOUS` | Vercel admin project env |

`CRON_SECRET` and `REVEALUI_CRON_SECRET` are different variables. Dispatch accepts a token that matches either family. Sub-jobs and the GitHub workflows only speak `REVEALUI_CRON_SECRET`.

## Vault paths already in the repo

The process reads the env vars above. The cataloged prod vault path is `revealui/prod/cron-secret` (`scripts/sync/secret-paths.ts`, `docs/SECRETS.md`), consumed by `vercel:api`, `vercel:admin`, and `fly:worker`. Staging uses `revealui/staging/cron-secret`.

Older notes also name `revealui/env/cron` (this runbook's namespace table) and `revealui/prod/stripe/cron-secret` (checkout smoke, flagged there as confirm-on-first-run). Confirm the live path with `revvault list` before writing. This procedure does not add a vault path for the `*_PREVIOUS` slots. Those slots live only on the hosting env for the window.

Vercel sync overwrites `REVEALUI_CRON_SECRET` from the vault and does not delete extra vars (`docs/runbooks/secret-rotation.md`). A sync while the vault still holds the outgoing value puts the outgoing value back into `REVEALUI_CRON_SECRET`. Update the vault to the incoming value before any sync in this window. Delete `*_PREVIOUS` yourself; sync will not remove it.

## Owner procedure

Do this per environment (production, then staging if that env has crons). Generate the new secret yourself (32+ characters). Keep it in the vault and the hosting UI. Do not commit it, print it into a workflow log, or paste it into a PR.

1. **Record the overlap, do not cut over callers yet.** On the Vercel **api** project, set `REVEALUI_CRON_SECRET_PREVIOUS` to the value that is live now. Set `REVEALUI_CRON_SECRET` to the new value. Repeat on the Vercel **admin** project (admin `verifyCronAuth` reads the admin process env). If Fly worker env receives `revealui/prod/cron-secret`, set the same pair there for the window so a synced worker does not keep a third copy.
2. **Vercel bearer, only if the name exists.** In the Vercel api project, check whether an env var **named** `CRON_SECRET` is present. If it is absent, skip this step. If it is present, set `CRON_SECRET_PREVIOUS` to its current value and set `CRON_SECRET` to the new bearer you chose (the same new value as `REVEALUI_CRON_SECRET` when those two are operated as one credential; a distinct value when they already differ).
3. **Point the vault at the incoming value** for the path confirmed above (`revealui/prod/cron-secret` in the catalog). Do this before `vercel:sync` so a sync cannot restore the outgoing value into `REVEALUI_CRON_SECRET`.
4. **Deploy** the api project (and admin, if that project's env changed). The deployment that is already serving keeps its old env until this deploy. Callers still sending the outgoing value succeed on both the old deployment and the new one.
5. **Verify both values before changing GitHub.** From a shell that has the two values only in variables (not echoed):
   - Wrong header returns 401:
     `curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'X-Cron-Secret: invalid' "$API_URL/api/cron/worker-liveness"`
   - Outgoing value is not 401 (200 when the worker URL is unset: the route is a no-op after auth):
     `curl -sS -o /dev/null -w '%{http_code}' -X POST -H "X-Cron-Secret: $REVEALUI_CRON_SECRET_PREVIOUS" "$API_URL/api/cron/worker-liveness"`
   - Incoming value is not 401:
     `curl -sS -o /dev/null -w '%{http_code}' -X POST -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" "$API_URL/api/cron/worker-liveness"`
   - If step 2 ran, `GET $API_URL/api/cron/dispatch` with `Authorization: Bearer $CRON_SECRET` and with `Authorization: Bearer $CRON_SECRET_PREVIOUS` is not 401. That request runs the daily job list; use it only for the bearer check. `GET /api/cron/uptime-check` with the same bearer is the lighter check. Dispatch itself calls that job with `POST` and `X-Cron-Secret`, so a bearer-only curl does not prove the fan-out path. The route only counts as proof when one of the four cron secret vars is set.
   - API logs may show `cron secret rotation in flight` when a request matches a `*_PREVIOUS` var. That line does not include the secret.
6. **Move callers.** Set the GitHub Actions secret `REVEALUI_CRON_SECRET` to the incoming value (used by `reconciliation-crons.yml` and `worker-liveness.yml`). Run both workflows with `workflow_dispatch` and confirm they finish green. Update any operator shell or external scheduler that still sends the outgoing value.
7. **Drop the outgoing value.** Remove `REVEALUI_CRON_SECRET_PREVIOUS` from api, admin, and Fly. Remove `CRON_SECRET_PREVIOUS` if step 2 set it. Redeploy api and admin.
8. **Verify the window is closed.** The outgoing `X-Cron-Secret` returns 401. The incoming value is not 401. If step 2 ran, the outgoing bearer returns 401 and the incoming bearer is not 401. GitHub `workflow_dispatch` for the two workflows is green again.

Hosted boot will refuse the deploy in step 4 or 7 if a previous var is set and shorter than 32 characters.

## Incident cutover

If the outgoing value is already exposed, skip the overlap: set only the incoming `REVEALUI_CRON_SECRET` (and `CRON_SECRET` when that name exists), update the vault and the GitHub secret, deploy, and confirm the outgoing value returns 401. Expect the 15-minute and 5-minute GitHub crons to fail until step 6's secret update lands. The overlap above is the path that avoids that gap.
