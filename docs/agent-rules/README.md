# Agent Rules

Tool-agnostic convention files for AI-assisted development in the RevealUI monorepo.

## What This Is

These files describe RevealUI's coding conventions, safety rules, and architectural boundaries. Any AI coding tool (Claude Code, Codex CLI, Gemini, Cursor, etc.) can reference them to produce code that follows project standards.

## How AI Tools Consume These Files

| Tool | Integration |
|------|-------------|
| **Claude Code** | `.claude/rules/*.md` files reference these conventions (Claude also has lifecycle hooks for enforcement) |
| **Codex CLI** | `.agents/skills/revealui-*/SKILL.md` files include this content with Codex-specific frontmatter |
| **Other tools** | Point your tool's instruction file at the relevant `docs/agent-rules/*.md` file |

## Files

| File | Covers |
|------|--------|
| `conventions.md` | TypeScript, ES Modules, git identity, parameterization |
| `monorepo.md` | Workspace protocol, turborepo, package conventions, publishing |
| `database-boundaries.md` | Dual-DB architecture, Supabase import boundary map |
| `tailwind-v4.md` | v4 syntax gotchas, migration notes, shared config |
| `testing.md` | Vitest, React Testing Library, Pro/OSS boundary, gate triage |
| `biome.md` | Linting, formatting, suppression protocol |
| `unused-declarations.md` | 5-step decision tree for unused variables/imports |
| `safety.md` | Credential guards, path restrictions, .env rules |
| `feature-gating.md` | Pro/OSS tier boundaries, `isLicensed` patterns |
| `test-prompts.md` | Cross-tool validation prompts |
| `evaluation-log.md` | Pass/fail tracking template |

## Updating Conventions

When a convention changes:
1. Update the canonical file here
2. Update the corresponding Codex skill in `.agents/skills/revealui-*/SKILL.md`
3. Claude rules in `.claude/rules/` are independent  -  update if needed
4. Run 2-3 test prompts from `test-prompts.md` to verify both tools pick up the change
