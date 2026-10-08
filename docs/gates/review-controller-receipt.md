---
title: "Review controller receipt gate"
description: "How the security review gate accepts a signed review receipt, and how the App is installed."
visibility: internal
status: draft
audience: maintainer
---

# Review controller receipt gate

The security review gate (`.github/workflows/security-review-gate.yml`, `scripts/validate/security-review-gate.cjs`) can clear a pull request in two ways.

1. Owner SSHSIG over the exact head, plus a request label. This path is unchanged.
2. A verified signed receipt envelope carried by the `RevealUI Receipt` check, and only when the repository variable `REVIEW_RECEIPT_MODE` is exactly `enforce`.

The check name, the App id, and the App slug are not a grant. The gate verifies the signed envelope from the receipted merge flow, bound to the current head SHA. Any other mode, including unset and `shadow`, ignores the receipt and keeps the owner SSHSIG path.

In enforce mode every pull request needs that receipt or the owner SSHSIG, including a pull request that touches no security marker.

## Path classes

Both classes live only in `packages/security/src/security-paths.shared.json`. The gate reads them through the shared classifier. Do not copy the lists into a second module.

| Class | What it covers | What clears it in enforce mode |
| --- | --- | --- |
| Normal | Everything that is not sensitive and not the controller | Verified receipt, or the owner SSHSIG |
| Sensitive | Workflows, composite actions, CodeQL config, Dependabot config, ruleset files, CODEOWNERS, auth, session, roles, permissions, admin access, Drizzle migrations and journals, the gate, `scripts/ci/`, `scripts/check-client-leaks.sh`, `scripts/**/backflow-merge-method-guard.cjs`, `scripts/**/gates-resolver.cjs` | Verified receipt plus one independent approving review, or the owner SSHSIG |
| Controller | `apps/review-controller/**` (including `fly.toml` and the isolated migration journal), `packages/db/src/schema/internal/review-controller.ts`, `packages/db/src/review-controller.ts`, product migrations whose names include `review_controller`, and `.github/workflows/docker.yml` (the workflow that builds the controller image) | Independent approving review on the head commit, or the owner SSHSIG. A receipt never clears these paths |

Outside enforce mode, a receipt still never clears. Controller paths still need an independent approving review or the owner SSHSIG. Other gated paths keep the owner SSHSIG. Pull requests that touch none of those paths still pass.

An independent review counts only when all of the following are true:

- The review state is `APPROVED`.
- `author_association` is `OWNER`, `MEMBER`, or `COLLABORATOR`.
- That account has write access on the repository.
- The account is not a bot and not a GitHub App.
- The account is not the pull request author and not a commit author.
- The review `commit_id` equals the current head SHA.

A live request-changes hold still blocks every grant.

## When the gate runs again

`pull_request_target` still runs the workflow definition from the base branch and checks out that base SHA. It does not check out pull request code.

A submitted pull request review also starts that same workflow. The checkout stays on the base SHA, and the token stays read-only. `pull_request_review` has no base-branch form, so a pull request that edits the workflow file can change the review-triggered steps. The base `pull_request_target` run remains the copy that a pull request cannot rewrite.

When a `RevealUI Receipt` check run from the controller App completes, `.github/workflows/security-review-gate-refresh.yml` re-runs the base gate. That refresh workflow is the default-branch copy. It does not check out pull request code. Its job is not named `Security review gate`, so a skipped requeue does not replace the required check.

## Threat model

The controller publishes `RevealUI Receipt` outside this repository's pull request workflows. This gate does not mint an App token and does not hold the signing key. It verifies the envelope the controller already published.

- Pull request workflows are untrusted. They must not be able to create the receipt check. Repository variables that name the trusted keys and the mode are owner settings. A pull request cannot change them for the base workflow that evaluates it.
- `pull_request_target` runs the workflow from the base branch. The job token has `actions: read`, `contents: read`, `pull-requests: read`, and `checks: read`. It cannot create check runs or push commits. The App private key and the receipt signing key are not requested.
- The refresh workflow may re-run the base gate. That needs `actions: write`. It still does not receive either private key.
- Setting `REVIEW_RECEIPT_MODE` to anything other than `enforce` leaves the owner SSHSIG as the only grant, even if the App id is already stored in a repository variable.
- Sensitive paths need a second account. The App cannot supply that review, and the author cannot supply it either.
- Controller paths have no receipt grant. That includes the controller service, its Fly config, its database schema and `review_controller` migrations, and `.github/workflows/docker.yml`. The controller cannot clear a change to itself.

## Owner steps

These settings live in GitHub and on the controller host. This pull request does not change them.

1. Install the GitHub App `revealfleet-review-controller` on the repository RevealUIStudio/revealui. That slug is the canonical App. Repository installation only. Do not install it on unrelated repositories. Do not hardcode the App's numeric id in gate code or in this repository.

2. Grant the App only these permissions. The controller writes check runs and does not post pull request reviews or comments, so pull requests stay read-only:
   - Checks: Read and write (`checks: write`)
   - Pull requests: Read-only (`pull_requests: read`)
   - Contents: Read-only (`contents: read`)
   - Actions: Read-only (`actions: read`)
   - Metadata: Read-only (`metadata: read`)
   GitHub includes metadata read on every App. Do not grant `pull_requests: write`. Do not grant contents write, administration, workflows write, secrets, or a ruleset bypass role.

3. Why those permissions are enough: the only write is the receipt check run (`checks: write`). Reading the pull request, its reviews, and inline review comments needs `pull_requests: read`. Reading git trees and blobs needs `contents: read`. Receipt evaluation lists workflow runs (`actions: read`). The publisher does not merge. Contents write would let the App push commits onto a pull request. Administration would let it change rulesets or Actions secrets. Pull request write would let the App submit the approving review that sensitive and controller paths require.

4. Follow-up for the receipted merge flow, not this pull request: `apps/review-controller/src/github-app-policy.ts` still requests `pull_requests: 'write'`. Drop that to `read`. Until that change, an installation limited to pull request read fails when the controller mints a token, because the token request still asks for write. Do not treat pull request write as permission for the App to satisfy the independent review.

5. Repository Actions variables on RevealUIStudio/revealui (Settings, Secrets and variables, Actions, Variables). Names only. A receipt does not clear unless `REVIEW_RECEIPT_MODE` is exactly `enforce`. Any other value, or leaving it unset, keeps today's owner SSHSIG behavior. App id and slug variables by themselves do not admit a receipt.
   - `REVIEW_RECEIPT_MODE`
   - `REVIEW_RECEIPT_CONTROLLER_APP_ID`
   - `REVIEW_RECEIPT_TRUSTED_KEYS`
   - `REVIEW_RECEIPT_POLICY_VERSION`
   - `REVIEW_RECEIPT_MAX_LIFETIME_MS`
   - `REVIEW_RECEIPT_REQUIRED_CHECKS`
   `REVEALFLEET_REVIEW_CONTROLLER_APP_ID` and `REVEALFLEET_REVIEW_CONTROLLER_APP_SLUG` are not a grant. The slug variable currently holds a URL, not a slug, so those two variables must not be used to accept a check. Delete both once `REVIEW_RECEIPT_MODE=enforce` and the signed envelope are in place. Do not hardcode an App id in their place.

6. Controller host secret store (the process that publishes the receipt check). Not this repository, not organization Actions secrets, and not a pull request workflow. Names only:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET`
   - `REVIEW_RECEIPT_PRIVATE_KEY`
   - `REVIEW_RECEIPT_KEY_ID`
   The private keys must never be added to GitHub Actions secrets or variables for RevealUIStudio/revealui. Workflows on pull request branches, the `pull_request_target` security review gate, and the check-run refresh workflow must not receive them.

7. Rulesets are stored in GitHub settings, not in this repository. On the ruleset that protects `test` and `main` (the required-check context is the job name `Security review gate`):
   - Keep `Security review gate` as a required status check.
   - Do not add `revealfleet-review-controller` as a bypass actor.
   - Do not grant the App permission to edit rulesets or dismiss reviews.
   - After the controller is publishing checks, you may add a second required status check named `RevealUI Receipt` and restrict that check to the `revealfleet-review-controller` App. Keep `Security review gate` required as well. The workflow gate is what verifies the envelope, enforce mode, sensitive-path dual control, and the controller-path ban on receipt grants.
   - No ruleset file in this repo needs an edit for this change.

8. Merge the receipted merge flow before this pull request. This gate verifies that flow's signed envelope. It does not replace the controller.
