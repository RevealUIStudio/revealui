# CLI simulation and execution outcomes

The shared CLI owns simulation before command execution. `--dry-run` and
planning-only command definitions produce an explicit simulated plan without
invoking confirmation, initialization, handlers, cleanup, or execution-history
storage. A plan does not certify that a real command would succeed. Normal
`release status` and `release preview` remain available for read-only inspection.

The existing `DryRunEngine` scopes simulation for supported file, database,
executor and dispatcher helpers. Nested calls and explicit `dryRun: false`
cannot disable inherited simulation. Commands are recorded structurally as
command/argv; safety does not depend on parsing a shell command or a blacklist.
The dispatcher refuses execution before dynamic import as well as subprocess
dispatch. Opaque CLI handlers are skipped entirely because they may use raw
JavaScript APIs outside these supported helpers.

The shared lifecycle returns a typed outcome with its exit code. Initialization,
handler and cleanup errors, returned unsuccessful results and cancellation are
settled before history finalization. Secondary cleanup/finalization failures
preserve the primary error. A CLI instance can be reused sequentially and
rejects overlapping runs before touching its active execution state.

Execution logger initialization/acquisition/release/close share one serialized
owner lifecycle. Ready instances are published only after successful schema
initialization. Owned leases keep the database open until the final consumer
releases it; legacy borrowed access does not acquire hidden ownership. Explicit
root mismatch is refused, and an unspecified root uses the current owner root
or the process working directory for the first acquisition. Partial initialization
is closed before retry. Failed database close quarantines that storage for the
process generation; subsequent acquisition refuses to claim a usable database.

Publication and release tags are owned by `.github/workflows/release.yml` on
`main`, with OIDC and environment `npm-publish`. Local `oss`, `pro`, `publish`
and `tag` compatibility commands fail with actionable guidance. The workflow
currently publishes OSS packages only and cannot create absent registry package
names. Canonical Pro and first-publication capabilities remain owner work under
the existing GAP-501 audit follow-up; this change does not claim to supply them.

## Existing exception inventory

| Location and prior behavior | Owner and durable destination | Removal evidence |
| --- | --- | --- |
| `scripts/cli/release.ts`: local OSS version/build/publish/GitHub-release/push flow and token-based Pro publish with `--no-git-checks` | Release workflow owner; canonical OSS OIDC contract, explicit Pro capability blocker | Local publication/tag/push execution bodies removed; actual CLI regressions assert no executor calls for compatibility publication commands and every simulation command/CLI alias. |
| `scripts/README.md`, `scripts/ARCHITECTURE.md`, `scripts/STANDARDS.md`, `scripts/validate/version-policy.ts`: local publication aliases advertised as supported release operations | Release CLI and operating-document owners; planning/status plus canonical workflow guidance | Maintained source/instruction diff removes local publishing advice and describes refusing compatibility commands. |
| `scripts/release/unpublished-oss.mjs`: read-only registry report also printed npm-login/local-publish/bootstrap/dispatch recipes | Release capability owner; canonical first-publication contract under GAP-501 | Read-only report preserved; parallel operational recipe removed and missing capability reported explicitly. |
| `scripts/cli/scripts.ts`: direct spawn bypassed shared executor; `list --dry-run` meant a discovery filter | Shared CLI/executor owner; single simulation and outcome contract | Raw spawn replaced by shared executor. Discovery filter becomes `--supports-dry-run`/`-d`; actual consumer tests cover filtering, simulation, child failure and history/force flag compatibility. |
| `packages/scripts/audit/execution-logger.ts`: pre-ready singleton and unowned close, plus maintained borrowed analytics/health/history accesses | Execution logger owner; serialized lifecycle and explicit leases around awaited work | Actual old-source public-seam tests reproduce premature publication and missing partial-init cleanup. New ownership tests cover independent release, stale release, root mismatch and close quarantine. |
| `scripts/validate/credentials.ts`: existing `NPM_TOKEN` publishing advice outside the release CLI | Credential validation/release policy owner; converge validation advice with supported canonical publication capability | Existing debt inventory only; not removed or claimed fixed by this change. |

Relevant regressions live in the maintained `packages/scripts` Vitest suite and
exercise actual shared classes, parser, executors and CLI consumers with inert
process/database effects. No release, tag, workflow dispatch, credentials or
provider database is exercised.
