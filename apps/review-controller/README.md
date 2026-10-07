# Review controller

This is a separately deployed RevealUI service for GitHub review-receipt
admission. It must remain isolated from `apps/server`, the agent daemon, the
license signer, and PR-controlled Actions.

## Implemented stage

The service authenticates GitHub webhook deliveries using the raw-body HMAC
signature, restricts intake to one configured repository and App installation,
and writes each delivery to a Postgres inbox before acknowledging it. The
delivery ID is unique, so GitHub retries are idempotent. A database outage
returns 503 and allows GitHub to retry. The inbox supports expiring, fenced
claims, bounded retries, and a polling worker with graceful shutdown. For PR,
review, check-run, check-suite, and merge-group deliveries, the worker obtains
a fresh GitHub App token scoped to this repository, fetches current PR files,
base/head trees, and exact-head check runs, then appends a shadow observation.
Manifests include rename/deletion and file-mode evidence; check observations
retain GitHub check-run and check-suite IDs. The shared security classifier
records its version and matched old/new paths for renames. The controller also
fetches changed regular-file blobs from those exact trees, verifies Git object
identities, rejects binary or invalid UTF-8 content, and caps review input at
100 files, 256 KiB per blob, and 2 MiB total. Source text stays in worker
memory and is not sent to a model provider by this service. Model review is
provided through the founder's ChatGPT subscription using Codex's GitHub
automatic-review integration. For signed GitHub `pull_request_review`
webhooks from `chatgpt-codex-connector[bot]`, the controller records the bot
account ID, review ID/state/action, reviewed and current head SHAs, timestamp,
and a digest of the review body. The controller fetches inline comments scoped
to that review ID, requires each comment to come from the same bot and reviewed
commit, and stores each comment's ID, path, line, severity, and body digest.
`[P0]` comments map to critical findings; other comments map conservatively to
high findings. Any inline comment, `CHANGES_REQUESTED` state, dismissal, or
review whose GitHub state is not `APPROVED` produces no approving evidence.
This deliberately treats a comment-only review with no inline comments as
unresolved rather than inferring approval from missing findings. Stale reviews
cannot approve. Review prose and source excerpts are not persisted.

When `REVIEW_RECEIPT_MODE=shadow` is configured, a review delivery with an
approving Codex observation also runs the receipt evaluator. It resolves
configured check selectors by stable check name and GitHub App ID to the
current exact-head run and suite IDs, then fetches the PR again and requires
its head/base to remain unchanged while collecting GitHub's merge-candidate
tree; the fresh PR must still be open, ready, and mergeable. The evaluator
signs in memory and appends only eligibility, receipt ID,
and envelope digest metadata to the shadow observation. It never stores the
envelope, publishes a check, or requests a merge. Missing, duplicate, running,
or failed check evidence leaves the candidate ineligible.

This remains shadow evidence only. The controller has no hosted model API
credentials or model-call path. Codex subscription reviews are configured in
the GitHub integration and do not use this service's model credentials. A
local receipt evaluator reconciles the current PR snapshot, exact-head review
observations, and required successful check-run identities before signing
through the shared Ed25519 receipt contract. Its tests cover stale checks and
reviews, dismissals, deterministic signing, and the higher sensitive-path
threshold. The evaluator runs only in the opt-in shadow mode described below.
Codex contributes one independent reviewer identity, so its evidence alone
cannot meet the shared two-review threshold for security-sensitive changes.
The current gate and branch protections remain authoritative.

The shared receipt store is append-only; shadow evaluation does not store its
signed envelope. A fixed-output App check-run writer is implemented and tested,
along with a persist-before-publish coordinator, but shadow mode does not call
them. The receipt store and check writer are not yet connected to a runtime
publishing mode. Merge-queue admission and auto-merge remain unimplemented. The
existing security gate remains authoritative until those stages and their
cutover evidence are complete.

The production Dockerfile assembles a pnpm production deployment and keeps
only the PostgreSQL driver external to the self-contained controller bundle.
The existing Docker workflow builds this image for relevant pull requests
without publishing it; its required summary fails if the image build fails.

## Isolation contract

- Use a dedicated GitHub App installation for `RevealUIStudio/revealui` only.
- Subscribe only to `pull_request`, `pull_request_review`, `check_run`,
  `check_suite`, and `merge_group`. Request `Checks: write`, `Contents: read`,
  `Merge queues: read`, and `Pull requests: write` (GitHub also requires
  repository metadata read). The source contract is
  `src/github-app-policy.ts`; do not grant Contents write, Actions, repository
  administration, or a ruleset bypass role.
- Store the App key and webhook secret in this Fly app's secret store, never in
  repository Actions secrets, agent workspaces, the general product worker,
  the license signer, or RevVault paths used by those services.
- Use a dedicated Postgres database and restricted controller role. The
  runtime role must not own schema or migration objects. Apply migrations
  separately; do not grant the runtime role DDL or update/delete on shadow
  observations or receipt records. The canonical schema is
  `packages/db/src/schema/internal/review-controller.ts`; the generated table
  migration and the append-only trigger migration live in
  `packages/db/migrations/` and are applied through the maintained database
  migration flow.
- Keep one controller machine during the initial Fly-volume/inbox design.
  Scale only after queue locking and receipt uniqueness are covered by tests.

## Configuration

Required runtime settings are `DATABASE_URL`, `GITHUB_WEBHOOK_SECRET`,
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_REPOSITORY_ID`,
`GITHUB_REPOSITORY_FULL_NAME`, `GITHUB_INSTALLATION_ID`, and `PORT`. The
webhook secret must contain at least 32 characters. The App installation
token is restricted to the configured repository and requests only Checks
write, Contents read, Merge queues read, and Pull requests write. The App has
no Contents write, Administration, ruleset bypass, or workflow permission.
Model-provider credentials are not part of this service configuration.

Receipt shadow evaluation is opt-in. Set `REVIEW_RECEIPT_MODE=shadow`,
`REVIEW_RECEIPT_KEY_ID`, `REVIEW_RECEIPT_PRIVATE_KEY` (Ed25519 PKCS#8 PEM),
`REVIEW_RECEIPT_POLICY_VERSION`, `REVIEW_RECEIPT_MAX_LIFETIME_MS` (60 seconds
to 24 hours), and `REVIEW_RECEIPT_REQUIRED_CHECKS` (a JSON array such as
`[{"name":"CI / test","appId":12345}]`). The key must live in this
controller's dedicated secret store. Stable selectors use check name and
GitHub App ID; current run and suite IDs come from the live GitHub response.
Unknown modes and partial or malformed shadow configuration stop startup.

The remaining durable work is App-bound check publication, merge-queue
candidate admission, and cutover evidence. Each stage must fail closed and
remain separately testable before the next one is enabled.
