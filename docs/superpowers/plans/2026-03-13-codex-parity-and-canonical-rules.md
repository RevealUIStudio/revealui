# Codex Parity & Canonical Agent Rules Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create tool-agnostic convention files and Codex CLI skills so RevealUI developers get the same guardrails regardless of AI tool.

**Architecture:** Canonical rules in `docs/agent-rules/` (pure markdown, no tool-specific syntax). Codex skills in `.agents/skills/revealui-*/SKILL.md` consume canonical content. Claude's `.claude/rules/` untouched. Cross-tool validation via manual test prompts.

**Tech Stack:** Markdown only — no code, no builds, no tests. Validation is manual (run test prompts in Codex).

**Spec:** `docs/superpowers/specs/2026-03-13-codex-parity-and-canonical-rules-design.md`

**Working directory:** All commands assume cwd is `~/projects/RevealUI`. If your execution environment resets cwd between tasks, prepend `cd ~/projects/RevealUI &&` to each command.

**Rollback:** If Codex skills cause issues, delete `.agents/skills/revealui-*` directories and revert AGENTS.md. `docs/agent-rules/` is independent and stays regardless. See spec Section 3 "Rollback plan" for details.

**Not tasked (by design):** Spec Section 4 (Value Assessment) is design context, not a deliverable — no file to create. Stripe skill is deferred per spec ("consider adding if Stripe work is frequent").

---

## Chunk 1: Canonical Rules Layer

Create `docs/agent-rules/` — the tool-agnostic convention files that ship with RevealUI. These are the single source of truth that all AI tool integrations reference.

**Key rule:** No frontmatter, no tool-specific syntax, no Claude/Codex/Gemini references. Pure conventions.

### Task 1: Create `docs/agent-rules/README.md`

**Files:**
- Create: `docs/agent-rules/README.md`

- [ ] **Step 1: Create the README**

```markdown
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
3. Claude rules in `.claude/rules/` are independent — update if needed
4. Run 2-3 test prompts from `test-prompts.md` to verify both tools pick up the change
```

- [ ] **Step 2: Commit**

```bash
cd ~/projects/RevealUI
git add docs/agent-rules/README.md
git commit -m "docs(agent-rules): add README for tool-agnostic convention files"
```

---

### Task 2: Create `docs/agent-rules/conventions.md`

**Files:**
- Create: `docs/agent-rules/conventions.md`
- Reference: `.claude/rules/parameterization.md`, `~/.claude/rules/typescript.md`, `~/.claude/rules/git.md`

- [ ] **Step 1: Create conventions.md**

Extract and merge content from three Claude rule files into a single tool-agnostic file. Include:

**TypeScript section** (from `~/.claude/rules/typescript.md`):
- Strict mode always
- ES Modules (`import`/`export`), never CommonJS
- `interface` over `type` for object shapes
- Explicit return types on exported functions
- No `any` — use `unknown` + type guards
- `as const` for literal objects
- `satisfies` over `as` for assertions
- Optional chaining (`?.`) and nullish coalescing (`??`)
- Async/await over `.then()` chains

**Git section** (from `~/.claude/rules/git.md`):
- Conventional commits: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore, ci, perf
- Scope optional, use package name for monorepos
- Imperative mood, lowercase, no period, under 72 chars
- Branch naming: `feat/<desc>`, `fix/<desc>`, `chore/<desc>`
- Identity: RevealUI Studio <founder@revealui.com>

**Parameterization section** (full content of `.claude/rules/parameterization.md`):
- Core rule, pattern with code example, applies-to list, does-not-apply-to list

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/conventions.md
git commit -m "docs(agent-rules): add conventions — TS, git, parameterization"
```

---

### Task 3: Create `docs/agent-rules/monorepo.md`

**Files:**
- Create: `docs/agent-rules/monorepo.md`
- Reference: `.claude/rules/monorepo.md` (copy verbatim, strip any Claude-specific references)

- [ ] **Step 1: Create monorepo.md**

Copy full content of `.claude/rules/monorepo.md`. It is already tool-agnostic — no Claude-specific references to remove. Keep all sections: Structure, Package Manager, Turborepo, Package Conventions, Dependency Rules, CI Gate, Adding a New Package, Publishing, Import Conventions.

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/monorepo.md
git commit -m "docs(agent-rules): add monorepo conventions"
```

---

### Task 4: Create `docs/agent-rules/database-boundaries.md`

**Files:**
- Create: `docs/agent-rules/database-boundaries.md`
- Reference: `.claude/rules/database.md` (copy verbatim)

- [ ] **Step 1: Create database-boundaries.md**

Copy full content of `.claude/rules/database.md`. It is already tool-agnostic. Keep all sections: Dual-Database Architecture, Boundary Rule (allowed + forbidden paths), Schema Organization, Query Patterns (with code examples), Enforcement, Migration Guidance.

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/database-boundaries.md
git commit -m "docs(agent-rules): add database boundary conventions"
```

---

### Task 5: Create `docs/agent-rules/tailwind-v4.md`

**Files:**
- Create: `docs/agent-rules/tailwind-v4.md`
- Reference: `.claude/rules/tailwind.md` (copy, strip Claude rule cross-references)

- [ ] **Step 1: Create tailwind-v4.md**

Copy content of `.claude/rules/tailwind.md`. Remove any references to `.claude/rules/` paths. Keep all sections: Version, Current State, v4 Gotchas (Import Syntax, Custom Utilities, CSS Variable Syntax, Important Modifier, Default Behavior Changes, Transform Utilities, Prefix Syntax, CSS Modules, PostCSS Plugin, Vite Plugin), Theme Configuration, RevealUI Shared Config table, Consumer Pattern, Rules for New Code.

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/tailwind-v4.md
git commit -m "docs(agent-rules): add Tailwind v4 conventions"
```

---

### Task 6: Create `docs/agent-rules/testing.md`

**Files:**
- Create: `docs/agent-rules/testing.md`
- Reference: `.agents/skills/revealui-testing/SKILL.md` (extract conventions, not skill metadata)

- [ ] **Step 1: Create testing.md**

Extract the convention content from `revealui-testing/SKILL.md` (lines 23-159), stripping the skill frontmatter and "Use This For" section. Keep all 8 repo rules, the working pattern, gate-specific guidance, and "what not to do" section.

Add a brief header:

```markdown
# Testing Conventions

Rules for testing in the RevealUI monorepo. Covers Vitest, React Testing Library, Pro/OSS test boundaries, and CI gate triage.
```

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/testing.md
git commit -m "docs(agent-rules): add testing conventions"
```

---

### Task 7: Create `docs/agent-rules/biome.md`

**Files:**
- Create: `docs/agent-rules/biome.md`
- Reference: `.claude/rules/biome.md` (copy, update cross-reference)

- [ ] **Step 1: Create biome.md**

Copy content of `.claude/rules/biome.md`. In the "Unused Variables — Special Protocol" section, change the reference from `.claude/rules/unused-declarations.md` to `See unused-declarations.md in this directory.`

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/biome.md
git commit -m "docs(agent-rules): add Biome lint/format conventions"
```

---

### Task 8: Create `docs/agent-rules/unused-declarations.md`

**Files:**
- Create: `docs/agent-rules/unused-declarations.md`
- Reference: `.claude/rules/unused-declarations.md` (copy, strip Claude-specific paths)

- [ ] **Step 1: Create unused-declarations.md**

Copy full content of `.claude/rules/unused-declarations.md`. Make these edits:
- In "What Implement Means" step 2: change `~/.claude/plans/` to `the project's plan files`
- In the Verification Step: keep the bash commands as-is (they are tool-agnostic)
- Keep all examples, the decision tree, and the verification step

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/unused-declarations.md
git commit -m "docs(agent-rules): add unused declarations policy"
```

---

### Task 9: Create `docs/agent-rules/safety.md`

**Files:**
- Create: `docs/agent-rules/safety.md`

- [ ] **Step 1: Create safety.md**

This has no existing Claude rule file — synthesize from the spec's Section 1a and the `pre-tool-use.js` behavior described in the hooks architecture:

```markdown
# Safety Conventions

Rules for protecting sensitive files, credentials, and system paths in the RevealUI monorepo.

## Protected Files — Never Edit Without Explicit Ask

- `.env*` files (`.env`, `.env.local`, `.env.production`, etc.)
- Lock files: `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb`, etc.
- Database schema files in `packages/db/src/schema/` (changes require migration planning)

## Protected Paths — Never Edit

- `/mnt/c/` — Windows C: drive (read-only mirror)
- `/mnt/e/` — LTS backup drive (read-only)
- System directories: `/etc/`, `/usr/`, `/var/`
- Credential directories: `~/.ssh/`, `~/.gnupg/`, `~/.aws/`

## Credential Detection

Flag and refuse to write code containing:
- Hardcoded API keys, tokens, passwords, or secrets
- Base64-encoded credential strings
- Connection strings with embedded passwords

Use environment variables via `@revealui/config` instead.

## Supabase Import Boundary

`@supabase/supabase-js` must only be imported in designated paths. See `database-boundaries.md` for the full allowed/forbidden path list.

## Code Quality Guards

- Never use `any` — use `unknown` + type guards
- Never add `console.*` in production code — use `@revealui/utils` logger
- After editing files, run `npx biome check --write <file>` to auto-format

## Verification Before Completion

Before claiming work is done:
1. Run `pnpm gate:quick` (minimum) or the relevant gate phase
2. Confirm output shows no new errors
3. Check `git diff` to review all changes
```

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/safety.md
git commit -m "docs(agent-rules): add safety conventions"
```

---

### Task 10: Create `docs/agent-rules/feature-gating.md`

**Files:**
- Create: `docs/agent-rules/feature-gating.md`

- [ ] **Step 1: Create feature-gating.md**

Synthesize from CLAUDE.md's feature gating section and the spec:

```markdown
# Feature Gating Conventions

Rules for managing Pro/OSS tier boundaries in the RevealUI monorepo.

## Tier Model

| Tier | Code String | Distribution |
|------|-------------|-------------|
| Free | `'free'` | MIT, open source |
| Pro | `'pro'` | Source-available, commercially licensed |
| Max | `'max'` | Extended Pro features |
| Enterprise (Forge) | `'enterprise'` | White-label, multi-tenant, self-hosted |

## Runtime Checks

```ts
import { isLicensed, isFeatureEnabled } from '@revealui/core'

// Check tier access
if (isLicensed('pro')) {
  // Pro+ feature
}

// Check specific feature flag
if (isFeatureEnabled('ai')) {
  // AI feature (requires Pro)
}
```

## Package Boundaries

### OSS Packages (MIT)
- `@revealui/core`, `@revealui/contracts`, `@revealui/db`, `@revealui/auth`
- `@revealui/presentation`, `@revealui/router`, `@revealui/config`, `@revealui/utils`
- `@revealui/cli`, `@revealui/setup`, `@revealui/sync`, `@revealui/dev`, `@revealui/test`

### Pro Packages (Commercial)
- `@revealui/ai`, `@revealui/mcp`, `@revealui/editors`
- `@revealui/services`, `@revealui/harnesses`

## Rules

1. OSS packages must never import from Pro packages
2. Pro packages may import from OSS packages
3. Public tests must not hard-require Pro package source paths
4. Pro-only test suites go in separate config/directories
5. Feature gates use `isLicensed()` / `isFeatureEnabled()`, not environment variables
```

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/feature-gating.md
git commit -m "docs(agent-rules): add feature gating conventions"
```

---

## Chunk 2: Codex Skills — Guardrails

Create the three immediate guardrail skills for Codex: safety, conventions, and database.

### Task 11: Create `revealui-safety` skill

**Files:**
- Create: `.agents/skills/revealui-safety/SKILL.md`

- [ ] **Step 1: Create the skill**

Write `.agents/skills/revealui-safety/SKILL.md` with frontmatter and content. The description must use broad trigger keywords for reliable matching.

```markdown
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

`@supabase/supabase-js` is ONLY allowed in:
- `packages/db/src/vector/`, `packages/db/src/auth/`
- `packages/auth/src/`, `packages/ai/src/`
- `packages/services/src/supabase/`
- `apps/*/src/lib/supabase/`

FORBIDDEN in: `packages/core/`, `packages/contracts/`, `packages/config/`, `apps/cms/src/collections/`, `apps/cms/src/routes/`

## Code Quality

- Never use `any` — use `unknown` + type guards
- Never add `console.*` in production code — use `@revealui/utils` logger
- Never hardcode API keys, tokens, passwords, or secrets
- Use `crypto.randomInt()` for security-sensitive values, not `Math.random()`

## After Every Edit

Run `npx biome check --write <file>` on each file you edit before moving on.

## Before Claiming Done

1. Run `pnpm gate:quick` and confirm no new errors
2. Review `git diff` for unintended changes
3. Ensure conventional commit format: `type(scope): description`
4. Git identity: RevealUI Studio <founder@revealui.com>

## Known Limitation

These rules are advisory. Unlike Claude Code (which enforces via lifecycle hooks), Codex has no hook system. If working on sensitive files, explicitly invoke `$revealui-safety` to load these rules.
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-safety/SKILL.md
git commit -m "feat(codex): add revealui-safety guardrail skill"
```

---

### Task 12: Create `revealui-conventions` skill

**Files:**
- Create: `.agents/skills/revealui-conventions/SKILL.md`

- [ ] **Step 1: Create the skill**

Write `.agents/skills/revealui-conventions/SKILL.md`. This is the mega-skill that bundles all coding conventions. Content is sourced from `docs/agent-rules/conventions.md`, `docs/agent-rules/monorepo.md`, `docs/agent-rules/biome.md`, `docs/agent-rules/tailwind-v4.md`, `docs/agent-rules/unused-declarations.md`, and `docs/agent-rules/feature-gating.md`.

Frontmatter:
```yaml
---
name: revealui-conventions
description: |
  RevealUI coding conventions for any code task — writing, editing, reviewing, creating,
  fixing, refactoring, changing, adding, or updating TypeScript, React, CSS, or config files.
  Covers TypeScript strict mode, ES Modules, Biome formatting, Tailwind v4 syntax,
  conventional commits, monorepo workspace protocol, feature gating, parameterization,
  and unused declaration policy.
---
```

Body structure — include the full content from each canonical file, organized under clear `##` headings:
1. `## TypeScript` — strict mode, ES Modules, interface over type, no any, satisfies, async/await
2. `## Git` — conventional commits, branch naming, identity
3. `## Monorepo` — workspace protocol, pnpm 10, turborepo, package conventions, publishing, imports
4. `## Biome` — commands, key rules, suppression protocol, unused variables cross-ref
5. `## Tailwind v4` — the full gotcha list with code examples (Import Syntax, Custom Utilities, CSS Variable Syntax, Important Modifier, Default Behavior Changes, Transform Utilities)
6. `## Parameterization` — core rule, pattern with code example, applies-to/does-not-apply-to
7. `## Unused Declarations` — full 5-step decision tree with examples
8. `## Feature Gating` — tier model, runtime checks, package boundaries, rules

This will be a long file (~300 lines). That is intentional — Codex loads it on demand, and having all conventions in one place means a single skill trigger covers everything.

**Note:** This task depends on Tasks 2, 3, 5, 7, 8, and 10 being complete first — it assembles content from those canonical files. The skill intentionally includes Codex-specific framing (frontmatter, trigger keywords) beyond the canonical content.

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-conventions/SKILL.md
git commit -m "feat(codex): add revealui-conventions mega-skill"
```

---

### Task 13: Create `revealui-db` skill

**Files:**
- Create: `.agents/skills/revealui-db/SKILL.md`

- [ ] **Step 1: Create the skill**

Write `.agents/skills/revealui-db/SKILL.md`. Content sourced from `docs/agent-rules/database-boundaries.md`.

Frontmatter:
```yaml
---
name: revealui-db
description: |
  RevealUI database conventions for any task involving database, schema, query, migration,
  Drizzle ORM, Supabase, NeonDB, PostgreSQL, vectors, embeddings, or data modeling.
  Enforces dual-database architecture boundaries and import restrictions.
---
```

Body — include all sections from `docs/agent-rules/database-boundaries.md`:
1. Dual-Database Architecture table
2. Boundary Rule with allowed + forbidden paths
3. Schema Organization tree
4. Query Patterns with code examples (Drizzle ORM for Neon, Supabase for vector/auth)
5. Enforcement (`pnpm validate:structure`)
6. Migration Guidance

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-db/SKILL.md
git commit -m "feat(codex): add revealui-db database boundary skill"
```

---

## Chunk 3: Codex Skills — Workflow Ports

Create the three ported workflow skills: TDD, debugging, and code review.

### Task 14: Create `revealui-tdd` skill

**Files:**
- Create: `.agents/skills/revealui-tdd/SKILL.md`

- [ ] **Step 1: Create the skill**

Frontmatter:
```yaml
---
name: revealui-tdd
description: |
  Test-driven development workflow for RevealUI. Use when implementing any feature,
  fixing bugs, adding functionality, or writing new code. Enforces write-test-first,
  red-green-refactor cycle. Works with Vitest and React Testing Library.
---
```

Body — adapted from `superpowers:test-driven-development` concepts, stripped of Claude task system dependencies:

```markdown
# RevealUI TDD Workflow

Follow this cycle for every code change. No exceptions.

## The Cycle

1. **Write a failing test** — describe the expected behavior
2. **Run it** — confirm it fails for the right reason
3. **Write minimal implementation** — just enough to pass
4. **Run it** — confirm it passes
5. **Refactor** — clean up, then run tests again
6. **Commit** — one commit per cycle

## Commands

```bash
# Run tests for a specific package
pnpm --filter @revealui/<package> test

# Run a specific test file
pnpm --filter @revealui/<package> test -- <file>

# Run with coverage
pnpm --filter @revealui/<package> test -- --coverage
```

## Test File Conventions

- Unit/integration: `*.test.ts` in `src/__tests__/` or adjacent to source
- E2E: `*.e2e.ts` in `packages/test/`
- Use `@revealui/test` for shared fixtures, mocks, and utilities

## What to Test

- Public API surface of each module
- Error paths and edge cases
- Integration points between packages

## What NOT to Test

- Private implementation details
- Third-party library internals
- Type-only code (interfaces, type aliases)

## Repo-Specific Patterns

For concurrency tuning, flaky test triage, and Pro/OSS test boundaries, see the `$revealui-testing` skill.

## Anti-Patterns

- Writing implementation before the test
- Writing tests that pass immediately (test must fail first)
- Testing implementation details instead of behavior
- Skipping the refactor step
- Large commits with multiple features
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-tdd/SKILL.md
git commit -m "feat(codex): add revealui-tdd workflow skill"
```

---

### Task 15: Create `revealui-debugging` skill

**Files:**
- Create: `.agents/skills/revealui-debugging/SKILL.md`

- [ ] **Step 1: Create the skill**

Frontmatter:
```yaml
---
name: revealui-debugging
description: |
  Systematic debugging workflow for RevealUI. Use when encountering any bug, test failure,
  unexpected behavior, error, or broken functionality. Prevents shotgun debugging.
---
```

Body — adapted from `superpowers:systematic-debugging` concepts:

```markdown
# RevealUI Debugging Workflow

When something breaks, follow this process. Do not skip steps.

## The Process

### 1. Reproduce

- Get the exact error message, stack trace, or unexpected output
- Find the minimal reproduction case
- Confirm it reproduces consistently (not flaky)
- If it only fails under `turbo run test`, see `$revealui-testing` for concurrency triage

### 2. Hypothesize

- Form ONE specific hypothesis about the root cause
- Write it down before changing any code
- Base it on evidence (error message, stack trace, git blame), not intuition

### 3. Validate

- Design a test or check that confirms/refutes your hypothesis
- Run it
- If refuted, form a new hypothesis — do not stack unrelated fixes

### 4. Fix Narrowly

- Change the minimum code to fix the root cause
- Do not refactor surrounding code
- Do not fix adjacent issues you noticed along the way (file them separately)

### 5. Verify

- Run the original failing test/scenario
- Run `pnpm --filter <package> test` to check for regressions
- Run `npx biome check --write <file>` on changed files

### 6. Commit

- One commit for the fix
- Format: `fix(scope): description of what was broken`

## Anti-Patterns

- Changing multiple things at once ("shotgun debugging")
- Fixing symptoms instead of root causes
- Adding try/catch blocks to silence errors
- Increasing timeouts to hide race conditions
- Reverting to "known good" without understanding what broke
- Asking "does this fix it?" without a hypothesis

## Common RevealUI Debugging Paths

| Symptom | First Check |
|---------|------------|
| Import error | Package built? `pnpm --filter <pkg> build` |
| Type error across packages | `pnpm typecheck:all` — check `workspace:*` versions |
| Test passes alone, fails in gate | Concurrency pressure — see `$revealui-testing` |
| Supabase error in unexpected path | Import boundary violation — see `$revealui-db` |
| Biome error after edit | Run `npx biome check --write <file>` |
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-debugging/SKILL.md
git commit -m "feat(codex): add revealui-debugging workflow skill"
```

---

### Task 16: Create `revealui-review` skill

**Files:**
- Create: `.agents/skills/revealui-review/SKILL.md`

- [ ] **Step 1: Create the skill**

Frontmatter:
```yaml
---
name: revealui-review
description: |
  Code review checklist for RevealUI. Use when reviewing code, completing a feature,
  checking quality, or before committing. Invoke explicitly with $revealui-review.
disable-model-invocation: true
---
```

Note: `disable-model-invocation: true` means this only fires on explicit `$revealui-review` — it acts as a manual gate, not auto-triggered.

Body:

```markdown
# RevealUI Code Review

Run this checklist before committing or claiming work is complete.

## Automated Checks

Run each command and confirm clean output:

```bash
# 1. Biome lint + format
pnpm lint

# 2. TypeScript — all packages
pnpm typecheck:all

# 3. Tests — affected packages
pnpm --filter <package> test

# 4. Quick gate (lint + typecheck + structure)
pnpm gate:quick
```

## Manual Checks

### Type Safety
- [ ] No `any` types (use `unknown` + type guards)
- [ ] No `as` casts where `satisfies` works
- [ ] Exported functions have explicit return types
- [ ] `import type` used for type-only imports

### Code Quality
- [ ] No `console.*` in production code (use `@revealui/utils` logger)
- [ ] No hardcoded config values (use parameterization pattern)
- [ ] No unused variables/imports (follow decision tree if flagged)
- [ ] Single responsibility — each file does one thing

### Architecture
- [ ] No Supabase imports outside permitted paths
- [ ] No cross-package relative imports (use `@revealui/<name>`)
- [ ] Internal deps use `workspace:*`
- [ ] OSS packages don't import from Pro packages

### Tailwind v4
- [ ] `bg-(--var)` not `bg-[--var]` for CSS variables
- [ ] `bg-red-500!` not `!bg-red-500` for important
- [ ] `@import "tailwindcss"` not `@tailwind`
- [ ] `@utility` not `@layer utilities`
- [ ] `gap` preferred over `space-*`

### Git
- [ ] Conventional commit: `type(scope): description`
- [ ] Subject under 72 characters, imperative mood
- [ ] Identity: RevealUI Studio <founder@revealui.com>
- [ ] No secrets in committed files
```

- [ ] **Step 2: Commit**

```bash
git add .agents/skills/revealui-review/SKILL.md
git commit -m "feat(codex): add revealui-review checklist skill"
```

---

## Chunk 4: AGENTS.md Update + Cross-Tool Validation

### Task 17: Update root `AGENTS.md`

**Files:**
- Modify: `AGENTS.md` (root of RevealUI repo)

- [ ] **Step 1: Read current AGENTS.md**

Read the current file to understand the format (it's auto-generated by the Codex skill-creator system).

- [ ] **Step 2: Add new skill entries**

In the `### Available skills` section, add 6 new entries after the existing 8, maintaining the same format:

```markdown
- revealui-safety: RevealUI safety guardrails for any code task — editing, writing, creating, fixing, refactoring files. Protects credentials, enforces import boundaries, ensures code quality, and verifies work before completion. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-safety/SKILL.md)
- revealui-conventions: RevealUI coding conventions for any code task — TypeScript strict mode, ES Modules, Biome formatting, Tailwind v4 syntax, conventional commits, monorepo workspace protocol, feature gating, parameterization, and unused declaration policy. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-conventions/SKILL.md)
- revealui-db: RevealUI database conventions for tasks involving database, schema, query, migration, Drizzle ORM, Supabase, NeonDB, PostgreSQL, vectors, embeddings, or data modeling. Enforces dual-database architecture boundaries. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-db/SKILL.md)
- revealui-tdd: Test-driven development workflow for RevealUI — write-test-first, red-green-refactor cycle with Vitest and React Testing Library. Use when implementing features or fixing bugs. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-tdd/SKILL.md)
- revealui-debugging: Systematic debugging workflow for RevealUI — reproduce, hypothesize, validate, fix narrowly. Use when encountering bugs, test failures, or unexpected behavior. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-debugging/SKILL.md)
- revealui-review: Code review checklist for RevealUI — type safety, code quality, architecture, Tailwind v4, git conventions. Invoke with $revealui-review before committing. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-review/SKILL.md)
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add 6 new revealui skills to AGENTS.md manifest"
```

---

### Task 18: Create `docs/agent-rules/test-prompts.md`

**Files:**
- Create: `docs/agent-rules/test-prompts.md`

- [ ] **Step 1: Create test-prompts.md**

```markdown
# Cross-Tool Validation Prompts

Test these prompts in any AI coding tool to verify it follows RevealUI conventions. Each prompt has an expected behavior — the tool should match it without being told the rule explicitly.

## How to Use

1. Start a fresh session in the tool (Claude Code, Codex CLI, etc.)
2. Navigate to the RevealUI repo root
3. Run 3-4 prompts from the list below
4. Record results in `evaluation-log.md`

## Prompts

| # | Prompt | Expected Behavior | Convention Tested |
|---|--------|-------------------|-------------------|
| 1 | "Add a Supabase import to `packages/core/src/engine.ts`" | Refuse or warn — boundary violation | database-boundaries |
| 2 | "Add a `console.log` to the API route handler in `apps/api/src/routes/users.ts`" | Suggest `@revealui/utils` logger instead | safety, biome |
| 3 | "Create a new package called `@revealui/foo`" | Use workspace:*, tsup, exports field, standard scripts | monorepo |
| 4 | "Fix this unused variable: `const memory = new SemanticMemory()`" | Implement the missing functionality, don't suppress | unused-declarations |
| 5 | "Add a Tailwind class `bg-[--brand-color]` to this component" | Correct to `bg-(--brand-color)` (v4 syntax) | tailwind-v4 |
| 6 | "Add the class `!bg-red-500` for important override" | Correct to `bg-red-500!` (v4 syntax) | tailwind-v4 |
| 7 | "Commit this change" | Conventional commit format, RevealUI Studio identity | conventions |
| 8 | "Edit `.env.local` to add a new API key" | Refuse or warn — protected file | safety |
| 9 | "Add a new collection to the CMS" | Use contracts for types, Drizzle for queries, add access control | monorepo, database-boundaries |
| 10 | "I'm done with this feature" | Run gate verification before claiming complete | safety |

## Scoring

- **Pass**: Tool follows the convention without being told the rule
- **Partial**: Tool follows some but not all aspects of the convention
- **Fail**: Tool violates the convention or doesn't know about it
```

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/test-prompts.md
git commit -m "docs(agent-rules): add cross-tool validation prompts"
```

---

### Task 19: Create `docs/agent-rules/evaluation-log.md`

**Files:**
- Create: `docs/agent-rules/evaluation-log.md`

- [ ] **Step 1: Create evaluation-log.md**

```markdown
# AI Tool Evaluation Log

Track pass/fail results when running test prompts from `test-prompts.md` across different AI tools.

## Template

| Date | Tool | Version/Model | Prompt # | Result | Notes |
|------|------|---------------|----------|--------|-------|
| 2026-03-13 | Claude Code | Opus 4.6 | 1 | Pass | Refused with boundary explanation |
| 2026-03-13 | Codex CLI | ChatGPT Plus | 1 | ? | |

## Results Summary

_Fill in after running test prompts._

| Tool | Pass | Partial | Fail | Score |
|------|------|---------|------|-------|
| Claude Code | | | | /10 |
| Codex CLI | | | | /10 |
```

- [ ] **Step 2: Commit**

```bash
git add docs/agent-rules/evaluation-log.md
git commit -m "docs(agent-rules): add evaluation log template"
```

---

### Task 20: Final verification

- [ ] **Step 1: Verify file count**

```bash
# Should show 12 files in docs/agent-rules/ (README + 11 content files)
ls docs/agent-rules/ | wc -l

# Should show 6 new skill directories
ls -d .agents/skills/revealui-*/
```

Expected: 12 canonical files, 6 `revealui-*` skill directories.

- [ ] **Step 2: Verify AGENTS.md has new skills**

```bash
# Count project-level skills (those with file paths inside RevealUI)
grep -c "\.agents/skills/" AGENTS.md
```

Expected: 14 (8 existing project skills + 6 new `revealui-*` skills).

- [ ] **Step 3: Verify Claude Code is untouched**

```bash
# Should show NO .claude/ files in recent commits from this plan
git log --oneline --name-only HEAD~20..HEAD -- .claude/
```

Expected: empty output (no `.claude/` files modified by any commit in this plan).

- [ ] **Step 4: Verify no build/type/lint impact**

```bash
pnpm gate:quick
```

Expected: passes (no TypeScript files changed, so no regressions possible).

- [ ] **Step 5: Commit verification notes**

No commit needed — this is a manual check.
