# Git Conventions

## Commit Messages
- Use conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore, ci, perf
- Scope is optional, use package name for monorepos (e.g., `feat(core): add parser`)
- Description in imperative mood, lowercase, no period
- Keep subject line under 72 characters

## GitHub CLI (`gh`) — repo pin form

Prefer short `-R owner/repo` over long `--repo`. Always pin the repo so the
command works from any cwd. Prefer unquoted labels when the label has no spaces.

```bash
gh pr edit 2482 -R RevealUIStudio/revealui --add-label sec-review:approved
```

Owner-action one-liners in wrap-ups must use this form (see disposition-actions).

## Branch Naming
- Feature: `feat/<short-description>` or `feat/<issue#>-<short-description>`
- Bugfix: `fix/<short-description>` or `fix/<issue#>-<short-description>`
- Chore: `chore/<short-description>` or `chore/<issue#>-<short-description>`
- When fixing a GitHub issue, include the issue number in the branch name

## Branch Flow (test → main)
- Feature/fix/chore branches base on **`test`**, never `main`. Open the PR against `test`.
- `main` only ever receives changes via a promotion PR whose head is `test` (enforced by `promotion-gate.yml`). Never push directly to `main` or `test`, and never open a feature PR directly against `main`.
- Merge manually after review — no auto-merge.

### Promotion playbook (test → main)

Call this **promote**, never hop.

1. Do not open a feature PR against `main`. Feature PRs land on `test` first.
2. Confirm `origin/main` is an ancestor of `origin/test` (`git merge-base --is-ancestor origin/main origin/test`). If not, land the auto-backflow PR (main → test) first so `promotion-gate` can pass.
3. Open a promotion PR whose **head is `test`** and **base is `main`**. Wait for `promotion-gate` and every other required check to go green. Do not merge while a required check is pending or red.
4. Merge with a **merge-commit only**: `gh pr merge <n> -R owner/repo --merge --delete-branch`. Never squash, never rebase-merge, never `--admin`, never `--auto`, never `--no-verify`.
5. Extra-approval: when the repo ruleset requires an approving review from the extra-approval account, do not self-merge the promotion without that review. Resolve the account from the ruleset / fleet hardline; do not paste a personal login into this file.
6. After the promote lands, confirm auto-backflow (main → test) so `test` cannot drift. If a promote was squashed, parentage is broken: repair with a signed `--no-ff` merge of `origin/main` into `test` via a backflow PR, then re-promote. Do not force-push `test` or `main`.

Opening or merging a promotion PR is owner-gated unless the owner named an in-session merge-when-green for that PR.

### HARDLINE: never branch off a feature branch (owner 2026-07-21)

Always cut new branches from **`origin/test`** (or `origin/main` when the
repo has no `test`). Never from an existing `feat/*` / `fix/*` / `chore/*` tip.

```bash
git fetch origin test
git switch -c fix/<name> origin/test
```

Grok worktrees: use `rfg … --worktree=…` (injects `--ref test`) or pass
`--ref test` explicitly. Architecture: ADR
`2026-07-21-harness-policy-runtime-launch-planes` (policy / runtime / launch).

## Issue → PR → Close Workflow
- PRs that fix a GitHub issue MUST include `Closes #N` in the PR description
- Place `Closes #N` at the top of the PR body (the template prompts for it)
- GitHub auto-closes the issue when the change reaches `main`. Because feature PRs merge to `test` first, the linked issue closes at the `test` → `main` promotion, not at the feature-PR merge
- One PR can close multiple issues: `Closes #1, Closes #2`

## Identity
- Professional repos (RevealUIStudio): display name `RevealUI Studio` plus the **signing account's** verified GitHub noreply address (shape `id+login@users.noreply.github.com` on the account that holds the SSH signing key). Do not paste a personal login into public rule copies; resolve the real address from the machine git config / fleet hardline when committing.
- Accepted additional author identity (owner 2026-09-30): `founder@revealui.com` also belongs to the project owner. Preserve this author identity when re-signing commits; do not replace it merely because the configured signing identity differs.
- Keep the current signing identity as the default. For signed commits, the committer email must be verified on the GitHub account holding the signing key. An unsigned commit needs a signature regardless of its author email; check GitHub's verification reason before diagnosing an identity mismatch.
