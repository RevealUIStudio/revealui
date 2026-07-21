# Git Conventions

## Commit Messages
- Use conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore, ci, perf
- Scope is optional, use package name for monorepos (e.g., `feat(core): add parser`)
- Description in imperative mood, lowercase, no period
- Keep subject line under 72 characters

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

Always cut new branches from **`origin/test`**, never from an existing
`feat/*` / `fix/*` / `chore/*` tip (even if that tip already equals test).

```bash
git fetch origin test
git switch -c fix/<name> origin/test
```

Grok worktrees: always pass `--ref test` (or use `rfg`, which injects it).
Without `--ref`, Grok bases the worktree on the source checkout's current
HEAD, which is wrong when the main tree is mid-feature.

## Issue → PR → Close Workflow
- PRs that fix a GitHub issue MUST include `Closes #N` in the PR description
- Place `Closes #N` at the top of the PR body (the template prompts for it)
- GitHub auto-closes the issue when the change reaches `main`. Because feature PRs merge to `test` first, the linked issue closes at the `test` → `main` promotion, not at the feature-PR merge
- One PR can close multiple issues: `Closes #1, Closes #2`

## Identity
- Professional repos (RevealUIStudio): RevealUI Studio <43050008+joshua-v-dev@users.noreply.github.com>
- Amended 2026-07-10: never "restore" founder@revealui.com. It belongs to the org account, so SSH-signed commits carrying it render Unverified and required-signatures rulesets silently block the merge. Full rationale in the fleet-level `~/.claude/rules/git.md`.
