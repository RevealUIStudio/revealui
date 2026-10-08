---
title: "Automated review receipts and merge admission"
description: "A secure, non-blocking PR review and merge flow with immutable evidence and no per-PR owner signing or labels."
visibility: internal
status: in-progress
audience: maintainer
---

# Automated review receipts and merge admission

## Goal

Routine feature-branch pull requests should move from creation through review,
required checks, and merge without asking the founder to approve with a second
account, sign a per-head SSH payload, add a gate label, or run terminal
commands. The merge remains secure because an independent trusted controller
evaluates the exact candidate and produces an auditable receipt before a
GitHub App reports the required check and requests the configured merge
method.

The first rollout covers feature branches targeting `test`. Promotion from
`test` to `main` remains on its existing path until merge receipts have been
validated through at least one full promotion cycle.

## Current implementation state

The shared `@revealui/harnesses/gates` package now has an Ed25519 receipt
signer and verifier with synthetic tests. The signer requires current expected
context and policy, signs canonical bytes, and verifies its own result before
returning. The verifier rejects non-canonical or ambiguous
JSON, unknown fields, untrusted key IDs, invalid signatures, stale repository,
PR, head, base, candidate, manifest or policy bindings, expired receipts,
duplicate reviewer identities/executions, blocking findings, and checks that
do not match the policy-bound App, check-run ID, and check-suite ID. It
requires distinct reviewer identities, systems, and executions. The controller
package also includes an append-only Postgres receipt store with idempotent
retry and receipt-ID collision rejection. The controller observes
subscription-based GitHub review evidence and evaluates candidate receipts in
shadow mode. The base-trusted security workflow can independently verify a
receipt carried by the controller App's exact-head check, but does not use it
to clear the active owner gate. The controller also has a disabled-by-default
`publish` mode that stores an eligible signed receipt before publishing an
App-owned check, with durable expiration work. The isolated controller is
deployed in `shadow` mode on one Fly machine, using a dedicated Neon project
and a controller-only receipt signer. It has published no receipt checks and
has no merge authority under the current rules.

The isolated `apps/review-controller` service authenticates webhook
signatures, checks the configured repository and App installation IDs, and
deduplicates deliveries in a Postgres inbox before returning success. An
expiring, fenced worker reads current PR state through repository-scoped App
tokens and appends exact-head shadow observations. Complete changed-file
manifests bind additions, deletions, renames, blob identities, and file modes;
the shared security classifier binds its version and matched paths into each
snapshot, including both sides of renames; check observations bind producer
App, head SHA, check-run ID, and check-suite ID. Truncated trees, incomplete
pagination, API failures, and stale check heads fail closed.
These observations evaluate subscription-based review evidence in shadow mode.
The base-trusted security gate now has a separate shadow verifier for a signed
envelope carried by the configured controller App's exact-head check run. It
re-fetches PR state, binds head/base/merge-candidate and current required-check
run identities and evidence digests, and verifies the receipt signature
against protected public keys. A changed completion record invalidates a
receipt even if a check-run identity is reused. The current owner-signature
gate remains authoritative; the controller runtime does not request a merge.

## Current blockers and owning primitives

The current workflow has two separate owner-dependent gates:

1. The active `protect-main-test` ruleset requires a CODEOWNERS review. The
   security CODEOWNERS entries name the founder's personal account, so a PR
   authored under RevealUI Studio still needs that account's native review.
2. The security review workflow requires both a request label and an SSHSIG
   override bound to the exact PR head. Cursor Cloud agents cannot produce
   this signature, so the owner must sign every new head and apply a label.

The current ruleset also requires signed commits. Cursor-produced commits that
lack a trusted signature can fail independently of those two gates.

The current Codex GitHub integration has not yet supplied the review evidence
that the receipt evaluator requires. Its observed findings use GitHub
`COMMENTED` reviews, while observed clean results use issue comments and a
short commit prefix; neither is an explicit `APPROVED` review bound to the full
head. The controller correctly holds those observations. Before positive
shadow evidence is possible, the existing reviewer-evidence collector and
receipt verifier need a provider-authenticated, full-head-bound explicit
verdict contract, or an isolated trusted review execution that produces one.
The contract must be tested against findings, stale and replayed results,
edited or deleted events, and unavailable provider data. This blocker is
tracked in [#3087](https://github.com/RevealUIStudio/revealui/issues/3087).

The owning replacement is the existing trusted review-gate and disposition
path. Replace per-PR human grants with an independently produced receipt,
extend the required check to validate that receipt, and configure a GitHub App
to request the normal merge once all required checks pass. Remove personal
CODEOWNERS approval as a routine merge condition only after the receipt check
is enforced and shadow-mode evidence meets the cutover criteria below.

## Trust boundaries

- Cursor Cloud and other coding agents may create branches, commits, and PRs.
  Their credentials cannot administer rulesets, install or configure the
  controller, write the controller's required check, or access its signing
  key.
- Pull request workflows and code are untrusted. The controller evaluates
  source using pinned, base-branch policy and isolated read-only review jobs.
  It never runs an untrusted PR workflow with a privileged token.
- The current shadow prototype uses one exact-head review from the existing
  Codex subscription integration and records exact-head `CodeQL`, `Security
  Gate`, `Dependency Review`, and `Secret Scanning (Gitleaks)` check evidence.
  These checks are deterministic scan evidence, not a second semantic review.
  This prototype does not establish that the checks came from base-trusted
  workflow definitions, so its receipts remain observational and cannot
  replace existing owner approval or branch protection.
- A merge controller runs outside PR-controlled workflow code. Prefer a
  narrowly scoped GitHub App with its signing key held in a managed secret
  store or KMS. A short-lived OIDC-issued credential is acceptable only when
  the identity policy binds the exact trusted workflow, repository, and
  environment. No private key or privileged token is stored where an agent or
  PR job can read it.
- The App has permissions to create the designated check and request the
  configured merge method. It is not a ruleset bypass actor and cannot change
  repository policy.

GitHub's required-status-check rule can bind a context to an expected GitHub
App, which prevents a PR workflow from satisfying the controller's check with
a same-named status. Automatic merge can queue the merge request until branch
protection requirements pass. See [ruleset rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
and [automatic merging](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request).

## Receipt contract

The controller stores a signed, append-only receipt for each evaluated
candidate. Its canonical content includes:

- immutable repository ID, PR number, head commit and tree, base commit,
  merge-base, and resulting merge-candidate tree;
- a complete changed-path manifest, including renames, deletions, and file
  modes, plus its digest;
- classifier, policy, workflow, and reviewer versions;
- each required check's expected App identity, check-run and check-suite IDs, conclusion,
  and evidence digest;
- automated review identities, reviewed tree digest, findings, disposition,
  and reason codes;
- creation time, policy expiry or revocation state, and receipt schema version;
- after merge, merge commit and tree, method, and timestamp.

The required `REVEALFLEET review receipt` check points to the immutable receipt
and is successful only for the currently observed head, base, policy version,
and merge candidate. A webhook is only a wake-up signal: before writing a
check or requesting a merge, the controller fetches current GitHub state and
compares it with the receipt. A changed head or base invalidates the receipt
and triggers a fresh evaluation. A stale run cannot overwrite a newer result.

The receipt is an admission record, not an authorization that expires after a
successful merge. Promotion validates the recorded merge receipt and the
promotion candidate's relationship to that merge; it does not re-run or
re-expire the original review grant.

## Evaluation and merge lifecycle

1. A PR open/update webhook schedules evaluation. Events are deduplicated by
   repository, PR, head, and base; retries are automatic and idempotent.
2. The controller refetches the complete changed-file set and candidate tree.
   API truncation, inaccessible data, unsupported merge state, or policy
   ambiguity prevents a successful receipt.
3. Existing deterministic security and quality gates run as required checks.
   The shadow prototype records one exact-head Codex subscription review plus
   exact-head security-check evidence. A finding requiring human judgment
   remains subject to the existing review and protection rules. Receipt
   shadowing does not grant merge authority; reviewer independence and trusted
   workflow provenance must be resolved before any policy cutover.
4. The controller writes the signed receipt and the App-bound required check.
   It then enables or requests GitHub auto-merge using the repository's
   configured merge method. The PR remains open and visible while checks run.
5. Immediately before merge, the controller confirms the head, base, receipt,
   check producers, and merge candidate are unchanged. Merge queue use is
   preferred where available; its `merge_group` candidate must receive the
   same admission evaluation.
6. A successful merge appends the merge commit and tree to the receipt. A
   failed or conflicting PR stays open with a machine-readable reason and is
   re-evaluated on the next relevant event.

There are no authorization labels or marker comments in the routine path.
Labels may remain for triage, but changing one cannot grant review or merge
authority.

## Failure and exception behavior

Controller outage, signature failure, receipt storage failure, API
rate-limits, incomplete file listings, reviewer disagreement, and check
provenance mismatch all fail closed while retrying automatically where
appropriate. They do not require an owner to sign or label a routine PR. An
exception request presents the precise finding, evidence, and policy clause
in the PR check; only exceptional judgment calls require a human decision.
Any break-glass decision is separately scoped, attributable, short-lived, and
recorded. It cannot silently become the routine path.

## Commit provenance

Do not ask the founder to re-sign Cursor Cloud commits. During shadow rollout,
record which commit identities the current signed-commit rules accept. The
durable end state must validate agent authorship and exact tree provenance
through the controller receipt and trusted merge candidate. If signed commits
remain mandatory, configure the supported agent/build integration to produce
verifiable signatures automatically. If the repository cannot enforce that
without exposing a founder key, replace the signed-commit requirement only in
the same cutover that makes the expected-App receipt check mandatory and
verifies the provenance controls below. Never disable it as a standalone
change.

## One-time bootstrap and plan constraints

The current repository owner, or later organization administrator, performs
one-time setup: install the narrowly scoped GitHub App, provision its isolated
signing identity and receipt store in a dedicated Neon project, grant the App
only the needed repository permissions, and configure the required check to
accept results only from that App. This is repository administration, not a
per-PR command or review. Agent identities must not have App installation,
ruleset administration, or secret-management permissions.

`RevealUIStudio/revealui` remains under the current `RevealUIStudio` user
account while its open PRs and drafts are resolved. Register the private App
under that current owner for the shadow rollout and install it only on this
repository. Before a later transfer to the `revealui-studio` organization,
verify the App registration's ownership-transfer behavior and plan for any
installation change. After transfer, revalidate the App and installation IDs,
webhook delivery, repository scope, and expected source of the required check
before relying on a receipt for admission.

Private repository ruleset capabilities depend on the organization plan.
Verify that `revealui-jv` can bind the required check to an expected App before
cutover. If the current plan cannot enforce this, retain its current protection
and record the plan upgrade or equivalent durable enforcement as a blocker;
do not claim the private repository has the same guarantees as public
`revealui` until the native control is available and tested. GitHub artifact
attestation availability also differs for private repositories, so the
receipt design uses a controller-managed signature and immutable store rather
than relying on Actions artifact attestations for private-repository evidence.

## Shadow rollout and cutover

1. Implement the receipt schema, signer/verifier, controller, required check,
   retry behavior, idempotency, and merge-time compare-and-set in the existing
   gate/disposition system. Add synthetic tests for replay, forged checks,
   stale heads/bases, modified workflows, policy downgrade, rename/deletion
   coverage, conflicting reviewers, incomplete pagination, concurrent runs,
   merge queue candidates, outages, and receipt tampering.
2. Run in shadow mode while current protections remain active. Compare every
   proposed decision with existing CI, source review, security checks, and
   merge results. Keep immutable evaluation records.
3. Require evidence from representative real candidates, including both
   ordinary and security-sensitive changes, plus the complete adversarial
   fixture suite. Cutover evidence must show zero false passes, complete
   receipt coverage, no stale-check overwrites, and successful recovery from
   controller/API outages. The owner sets the sample size based on observed
   change volume; elapsed time alone is not a security criterion.
4. Configure the App-bound required check. Verify that an agent-created
   same-named check cannot satisfy it and that the App cannot bypass any other
   required rule. Confirm the actual merge path on test branches.
5. Remove routine personal-account CODEOWNERS approval and per-head owner
   SSHSIG/label requirements only after exact-head evidence demonstrates the
   new check is required and all cutover criteria pass. Keep human review for
   exceptional decisions and policy changes.
6. Observe one complete `test` to `main` promotion cycle, then migrate the
   promotion path and private `revealui-jv` independently after its plan and
   ruleset controls are verified.

## Existing one-off inventory and removal evidence

| Existing path | Current behavior | Durable destination | Removal evidence |
|---|---|---|---|
| `.github/CODEOWNERS` | Names a personal account for protected sensitive paths. | Independent receipt review and App-bound required check; human escalation only for explicit exceptions. | Ruleset no longer requires routine founder approval; synthetic tests show exact App receipt is required. |
| `scripts/validate/security-review-gate.cjs`, `.github/workflows/security-review-gate.yml`, and `docs/gates/signed-override.md` | Requires a request label and exact-head owner SSHSIG for sensitive changes, with a legacy-named signer allowlist variable. | Extend this gate to validate controller-signed exact-candidate receipts; remove the signer variable, label, and signature from routine decisions. | Old labels and SSHSIG comments cannot clear a PR; replay, stale-head, and forged-check tests pass; no active workflow or operator guide reads the legacy signer variable. |
| `.github` ruleset signed-commit requirement | Rejects commits without an accepted signature. | Verified agent/build provenance bound to the reviewed tree and merge receipt. | Every supported agent path has reproducible provenance; unsigned PR-controlled checks cannot satisfy admission. |
| `scripts/gates/signed-override/` and `docs/gates/signed-override.md` | Makes the founder create and sign a payload for each exact head. | Exceptional, separately audited disposition only; never routine merge admission. | No routine gate or operator guide directs per-head signing; exception path remains bounded and tested. |
| Request labels and `guardrail2-verdict` discussion markers | Labels/comments request or influence a review disposition. | Controller-owned evaluations with trusted reviewer identity and exact-tree binding. | Untrusted author comments and labels cannot authorize; existing hold signals still prevent merge. |
| `revealui-review-controller` database and role in the product `RevealUI` Neon project's main branch | The controller database and product database share the branch, compute, and `neondb_owner` migration principal. A separate database alone cannot isolate the receipt store from that shared owner. | Dedicated controller Neon project with separate migration owner and SQL-created restricted runtime role; keep the existing database untouched during migration. | Dedicated-project migrations and runtime grants pass against live PostgreSQL; shadow receipts are verified; the owner confirms no controller service uses the shared-project database before retiring it. |

## Cutover decision

This proposal does not remove or weaken any active protection. The isolated
controller is deployed in shadow mode; its App check publisher remains
inactive and cannot authorize a merge under the current rules. Shadow
evidence, repository plan verification, trusted review provenance, App
identity enforcement, and the cutover ruleset change must be reviewed and pass
as one migration. The public and private repositories may cut over at different
times. Until then,
the existing manual gate remains in force, and its per-PR burden is recorded
as a known blocker rather than hidden behind a one-off shortcut.

The implementation follow-up remains in this owning path: validate live
receipt publication and expiration, establish trusted review provenance,
configure the App-bound required check, and evaluate `merge_group` candidates
before changing any active rule.
Validation must cover stale checks, counterfeit same-name checks from another
App, moved base/head, merge conflicts, incomplete file manifests, controller
and API outages, receipt replay, key rotation, and actual source-App
enforcement.
