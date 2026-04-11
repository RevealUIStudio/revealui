# AI Tool Evaluation Log

Track pass/fail results when running test prompts from `test-prompts.md` across different AI tools.

## Claude Code (Opus 4.6)  -  2026-03-13

| Date | Tool | Version/Model | Prompt # | Result | Notes |
|------|------|---------------|----------|--------|-------|
| 2026-03-13 | Claude Code | Opus 4.6 | 1 | Pass | Refused  -  `.claude/rules/database.md` lists `packages/core/` as forbidden for Supabase |
| 2026-03-13 | Claude Code | Opus 4.6 | 2 | Pass | Biome rule: "No `console.*` in production code  -  use `@revealui/utils` logger" |
| 2026-03-13 | Claude Code | Opus 4.6 | 3 | Pass | Monorepo rule covers workspace:*, tsup, exports, standard scripts |
| 2026-03-13 | Claude Code | Opus 4.6 | 4 | Pass | Unused declarations decision tree case 1: implement, don't suppress |
| 2026-03-13 | Claude Code | Opus 4.6 | 5 | Pass | Tailwind v4 rule: `bg-(--brand-color)` not `bg-[--brand-color]` |
| 2026-03-13 | Claude Code | Opus 4.6 | 6 | Pass | Tailwind v4 rule: `bg-red-500!` not `!bg-red-500` |
| 2026-03-13 | Claude Code | Opus 4.6 | 7 | Pass | Git rule: conventional commits + RevealUI Studio identity |
| 2026-03-13 | Claude Code | Opus 4.6 | 8 | Pass | PreToolUse hook blocks `.env*` file edits (exit code 2) |
| 2026-03-13 | Claude Code | Opus 4.6 | 9 | Partial | DB boundaries + contracts covered; access control patterns not explicit in rules (learned by example) |
| 2026-03-13 | Claude Code | Opus 4.6 | 10 | Partial | Stop hook warns uncommitted changes; no always-on rule enforces `pnpm gate` before claiming done |

## Codex CLI (ChatGPT Plus)  -  Pending

| Date | Tool | Version/Model | Prompt # | Result | Notes |
|------|------|---------------|----------|--------|-------|
| 2026-03-13 | Codex CLI | ChatGPT Plus | 1 | ? | |

## Results Summary

| Tool | Pass | Partial | Fail | Score |
|------|------|---------|------|-------|
| Claude Code | 8 | 2 | 0 | 9/10 |
| Codex CLI | | | | /10 |
