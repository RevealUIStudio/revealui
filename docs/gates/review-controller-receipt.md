---
title: "Review controller receipt gate"
description: "How the security review gate accepts a review controller check run, and how the App is installed."
visibility: internal
status: draft
audience: maintainer
---

# Review controller receipt gate

The security review gate (`.github/workflows/security-review-gate.yml`, `scripts/validate/security-review-gate.cjs`) can clear a pull request in two ways.

1. Owner SSHSIG over the exact head, plus a request label. This path is unchanged.
2. A completed success check run named `RevealUI Receipt` on that same head, created by the GitHub App RevealFleet Review Controller.

The check name is required and is not sufficient. The gate reads repository variables `REVEALFLEET_REVIEW_CONTROLLER_APP_ID` and `REVEALFLEET_REVIEW_CONTROLLER_APP_SLUG` and accepts the check only when both the app id and the app slug match. A new push changes the head SHA, so a receipt recorded on the previous head no longer matches.

Paths that do not touch a security marker (`scripts/validate/security-paths.shared.json`) or a sensitive class (`scripts/validate/receipt-sensitive-paths.json`) still pass with no grant. That keeps the check safe to require on every pull request.

## Sensitive paths

The sensitive class list lives only in `scripts/validate/receipt-sensitive-paths.json`.

| Class | What it covers |
| --- | --- |
| workflows | `.github/workflows/**` |
| actions | `.github/actions/**` |
| auth | Auth package, session, roles, permissions, and admin access |
| migrations | Drizzle SQL migrations and the journal under `packages/db/migrations/` |
| gate | The gate script, the sensitive path list, and the shared security path list |
| codeowners | `CODEOWNERS` |
| rulesets | In-repo ruleset files, when present |

An App receipt alone does not clear these. The pull request also needs one current `APPROVED` review from an account that is not the pull request author and not the App bot (`{slug}[bot]`). The author approving their own pull request does not count. The owner SSHSIG still clears these paths without the App.

A live request-changes hold still blocks every grant.

## Threat model

The controller that publishes `RevealUI Receipt` runs outside this repository's pull request workflows. This gate does not mint an App token and does not verify a signed envelope. The controller is responsible for publishing success only after its own receipt checks. This repository's gate then checks that the published run belongs to the configured App and to the current head.

- Pull request workflows are untrusted. They must not be able to create the receipt check. GitHub can bind a required status check to an expected App. This workflow also checks app id and slug, so a same-named check from another App or from GitHub Actions does not pass.
- `pull_request_target` runs the workflow from the base branch. The job token has `contents: read`, `pull-requests: read`, and `checks: read`. It cannot create check runs, push commits, or read Actions secrets beyond what the workflow file requests. The App private key is not requested.
- The App private key must not be stored as an Actions secret or variable on this repository. A bot that authors pull requests must not have that key. Otherwise the author can sign a check run for their own head.
- Sensitive paths need a second account. The App cannot supply that review, and the author cannot supply it either.
- Repository variables that name the App are owner settings. A pull request cannot change them for the base workflow that evaluates it.
- An unset App id and slug leaves the owner SSHSIG as the only grant. A partial or malformed pair does not match any check.

Promotion from `test` to `main` still uses the existing upstream owner-signature coverage when the promote pull request itself has no direct grant. When the App variables are set, associated feature pull requests are classified again, and a receipt grant has to satisfy the same sensitive-path rule.

## Owner steps

These settings live in GitHub and on the controller host. This pull request does not change them.

1. Install the GitHub App named RevealFleet Review Controller on the repository RevealUIStudio/revealui. Repository installation only. Do not install it on unrelated repositories.

2. Grant the App only these permissions:
   - Checks: Read and write (`checks: write`)
   - Pull requests: Read-only (`pull_requests: read`)
   - Contents: Read-only (`contents: read`)
   - Metadata: Read-only (`metadata: read`)
   GitHub includes metadata read on every App. Do not grant contents write, administration, members, secrets, Actions, workflows, or a ruleset bypass role.

3. Why those permissions are enough: the controller creates one check run (`checks: write`) and reads the pull request and its files (`pull_requests: read`, `contents: read`). Contents write would let the App push commits onto a pull request. Administration would let it change rulesets, webhooks, or Actions secrets. Actions access would expose workflow secrets to a process that evaluates untrusted pull request content. Pull request write would let the App submit the approving review that sensitive paths require, so the App could satisfy both halves of the dual control by itself.

4. Repository Actions variables on RevealUIStudio/revealui (Settings, Secrets and variables, Actions, Variables). Names only:
   - `REVEALFLEET_REVIEW_CONTROLLER_APP_ID` (the App's numeric id)
   - `REVEALFLEET_REVIEW_CONTROLLER_APP_SLUG` (the App's URL slug)
   These are identifiers. They are not private keys. Leave them unset until the App exists. An unset pair keeps the owner SSHSIG path as the only grant.

5. Controller host secret store (the process that publishes the receipt check). Not this repository, not the organization Actions secrets, and not a pull request workflow. Names only:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY`
   - `GITHUB_WEBHOOK_SECRET` (only if that host verifies webhook deliveries)
   The private key must never be added to GitHub Actions secrets or variables for RevealUIStudio/revealui. Workflows on pull request branches, and the `pull_request_target` security review gate, must not receive it. A pull request author who can read that key can mint a check run and clear their own pull request.

6. Rulesets are stored in GitHub settings, not in this repository. On the ruleset that protects `test` and `main` (the required-check context is the job name `Security review gate`):
   - Keep `Security review gate` as a required status check.
   - Do not add RevealFleet Review Controller as a bypass actor.
   - Do not grant the App permission to edit rulesets or dismiss reviews.
   - After the controller is publishing checks, you may add a second required status check named `RevealUI Receipt` and restrict that check to the RevealFleet Review Controller App. That stops a different App or a workflow from satisfying a same-named check. Keep `Security review gate` required as well. The workflow gate is what enforces sensitive-path dual control and the owner SSHSIG fallback.
   - No ruleset file in this repo needs an edit for this change.

7. Merge this pull request after #3076. The controller in that pull request is what publishes the `RevealUI Receipt` check. This gate only accepts that check. It does not copy the controller.
