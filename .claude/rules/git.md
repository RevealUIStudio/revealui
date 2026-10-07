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
- Amended 2026-07-10: never "restore" founder@revealui.com. It belongs to the org account, so SSH-signed commits carrying it render Unverified and required_signatures rulesets silently block the merge. Full rationale in the fleet-level Studio git hardline (not re-copied here).
