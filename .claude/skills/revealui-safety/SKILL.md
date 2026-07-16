---
name: revealui-safety
description: |
  RevealUI safety guardrails for any code task — editing, writing, creating, fixing,
  refactoring, changing, adding, updating, or removing files. Protects credentials,
  enforces import boundaries, ensures code quality, and verifies work before completion.
---

# RevealUI Safety

Follow these rules for ALL code changes in the RevealUI monorepo.

## Protected Files — Ask Before Editing

- `.env*` files (`.env`, `.env.local`, `.env.production`, etc.)
- Lock files: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`
- Database schema files in `packages/db/src/schema/` — changes require migration planning

## Protected Paths — Never Edit

- `/mnt/c/`, `/mnt/e/` — Windows mounts (read-only)
- System/credential directories: `/etc/`, `~/.ssh/`, `~/.gnupg/`, `~/.aws/`

## Import Boundaries

All persistence goes through the single Drizzle/Neon client (`@revealui/db`). Do not introduce a second database client or a separate vector/auth SDK — vector data lives in pgvector on the same Neon database. (A customer-facing Supabase MCP adapter exists for connecting a customer's own Supabase project; that is not an internal store.)

## Code Quality

- Never use `any` — use `unknown` + type guards
- Never add `console.*` in production code — use `@revealui/utils` logger
- Never hardcode API keys, tokens, passwords, or secrets
- Use `crypto.randomInt()` for security-sensitive values, not `Math.random()`

## Static Analysis

- For security and architecture validation scripts, prefer AST-based analysis over regex when the rule depends on syntax or code shape
- Use regex only for heuristic inventory scans (for example obvious secret patterns), not as the source of truth for code-security conclusions

## After Every Edit

Run `npx biome check --write <file>` on each file you edit before moving on.

## Before Claiming Done

1. Run `pnpm gate:quick` and confirm no new errors
2. Review `git diff` for unintended changes
3. Ensure conventional commit format: `type(scope): description`
4. Git identity: commit as your own GitHub noreply address (`<ID>+<username>@users.noreply.github.com`)

## Known Limitation

These rules are advisory. Unlike Claude Code (which enforces via lifecycle hooks), Codex has no hook system. If working on sensitive files, explicitly invoke `$revealui-safety` to load these rules.
