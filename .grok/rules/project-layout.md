# RevealUI monorepo (Grok project add-on)

Public agent entrypoint remains root `AGENTS.md` / `CLAUDE.md`. This file is
Grok-native layout only. Shared hardlines are generated into
`.grok/rules/<id>.md` from `@revealui/harnesses` (preamble tier 1). Do not
name this file after a definition rule id (`monorepo.md` is reserved).

## Layout

- `apps/server` — Hono API `:3004`
- `apps/admin` — Next.js 16 `:4000`
- `apps/docs` — Vite docs
- `apps/marketing` — Vite marketing
- `packages/*` — OSS MIT + Pro FSL packages

## Load-bearing packages

| Concern | Package |
|---------|---------|
| CMS engine | `@revealui/core` |
| Schemas | `@revealui/contracts` + `@revealui/db` |
| UI | `@revealui/presentation` + tokens |
| Hosted gates | server middleware entitlements + `@revealui/core/license` + `@revealui/paywall` |
| Agents | `@revealui/ai`, `mcp`, `harnesses`, `engines` |

## Commands

```bash
pnpm dev:app
pnpm gate
pnpm test
pnpm validate:claims
```

## Skills already in-repo

`.agents/skills/` and `.claude/skills/` (conventions, db, testing, safety, tdd).
On-demand definition rules: `.grok/skills/rule-*/`. Prefer those over inventing
new procedure.

## Branch

Feature PRs → `test`. Never PR direct to `main`.

Shared branch policy is **not** authored here (Plane A). Canon:
`~/.claude/rules/git.md` + revcon `profiles/revfleet/claude/rules/git.md`.
Launch: `rfg` (Plane C). Architecture ADR:
`2026-07-21-harness-policy-runtime-launch-planes`.

## Worktree isolation (HARDLINE)

Multi-step edits: `git worktree add ~/revfleet/.wt/<name> -b <branch> origin/test`.
Do not use the shared `~/revfleet/revealui` checkout for concurrent claims.
Dirty branch switches are blocked by `dirty-checkout-guard.js`.
Full rule: `~/.grok/rules/06-worktree-isolation.md`.
Preferred launch: `rfg revealui --worktree=<label>` (injects `--ref test` when omitted).
