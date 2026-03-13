# Codex CLI Parity & Canonical Agent Rules

**Date**: 2026-03-13
**Status**: Approved
**Scope**: Codex CLI guardrails, canonical rules layer, skill ports, value assessment, cross-tool validation

---

## Context

RevealUI ships with a mature Claude Code setup: 6 lifecycle hooks, multi-agent coordination, 8 `.claude/rules/` files, and workflow skills (TDD, debugging, brainstorming). The monorepo has 5 apps and 18 packages. Codex CLI is now running in the RevealUI monorepo with `trusted` mode and 8 project-specific skills, but lacks the guardrails, convention enforcement, and workflow discipline that Claude provides.

### Goals

1. **Immediate**: Make Codex safe and productive for the founder's month of evaluation
2. **Long-term**: Create tool-agnostic convention files that ship with RevealUI so harness users get the same conventions regardless of their AI tool
3. **Assessment**: Frame RevealUI's value at three tiers — standalone, with Claude, with Codex

### Constraints

- Claude Code setup is **untouched** — nothing removed or modified
- Everything is **additive** — new files only
- Codex skills are **on-demand** (triggered by description match), not always-on like Claude rules
- Canonical rules live in the **public repo** (they ship with RevealUI)

---

## Section 1: Immediate Codex Guardrails

Three new Codex skills + hardened `AGENTS.md` for personal use during the evaluation month.

### 1a. `revealui-safety` skill

**Location**: `.agents/skills/revealui-safety/SKILL.md`
**Trigger**: Any code editing, file creation, or refactoring task in RevealUI

Content — soft equivalent of `pre-tool-use.js`:

- Never edit `.env*`, lock files, or files in `packages/db/src/schema/` without explicit ask
- Never import `@supabase/supabase-js` outside permitted paths (list from `.claude/rules/database.md`)
- Never use `any` — use `unknown` + type guards
- Never add `console.*` in production code — use `@revealui/utils` logger
- Flag credential-looking strings in code (API keys, tokens, passwords)
- Never edit files under `/mnt/c/` or `/mnt/e/` (Windows mounts are read-only)
- After editing any file in RevealUI, run `npx biome check --write <file>` before moving on
- Before claiming work is done, run the relevant gate phase (`pnpm gate:quick` minimum) and confirm output

**Known limitation**: Codex has no lifecycle hooks. These rules are advisory — the LLM must remember to follow them. Claude enforces equivalent rules via `pre-tool-use.js` and `post-tool-use.js` hooks which block/auto-fix automatically. For sensitive operations, users should explicitly invoke `$revealui-safety`.

### 1b. `revealui-conventions` skill

**Location**: `.agents/skills/revealui-conventions/SKILL.md`
**Trigger**: Any code writing, editing, or review task in RevealUI

Bundles:

- **TypeScript**: strict mode, ES Modules, `interface` over `type`, no `any`, `satisfies` over `as`, async/await
- **Git**: conventional commits (`type(scope): description`), branch naming (`feat/`, `fix/`, `chore/`), identity RevealUI Studio
- **Monorepo**: `workspace:*` for internal deps, pnpm 10, turborepo patterns, `@revealui/<name>` naming, publishing via changesets
- **Feature gating**: Pro features use `isLicensed('pro')` and `isFeatureEnabled('ai')`, tiers: free/pro/max/enterprise
- **Biome**: formatting rules, `// biome-ignore` with reason, suppression protocol
- **Tailwind v4**: `@import "tailwindcss"` not `@tailwind`, `@utility` not `@layer`, `bg-(--var)` not `bg-[--var]`, `bg-red-500!` not `!bg-red-500`, prefer `gap` over `space-*`
- **Parameterization**: extract config to named constants, type with interface, provide `configure*()` override
- **Unused declarations**: implement first, suppress as last resort — full 5-step decision tree

### 1c. `revealui-db` skill

**Location**: `.agents/skills/revealui-db/SKILL.md`
**Trigger**: Database, schema, query, migration, Drizzle, Supabase, Neon keywords

Content:

- Dual-DB architecture: NeonDB (REST content) vs Supabase (vectors/auth)
- Import boundary map: allowed and forbidden paths for `@supabase/supabase-js`
- Schema organization: `packages/db/src/schema/` subdirectories
- Query patterns: Drizzle ORM for Neon, Supabase client for vector/auth only
- Migration guidance: content → Drizzle, AI/vector → Supabase, never mix in same module

### 1d. Hardened `AGENTS.md`

Update root `AGENTS.md` to include the three new skills with trigger descriptions. Maintain the existing skill-loading protocol (progressive disclosure, trigger rules, context hygiene).

---

## Section 2: Canonical Rules Layer

Tool-agnostic convention files that ship with RevealUI in the public repo.

### 2a. Directory structure

```
docs/agent-rules/
├── README.md                # What this is, how AI tools consume it
├── conventions.md           # TS, ES Modules, git identity, parameterization
├── monorepo.md              # Workspace protocol, turborepo, package conventions, publishing
├── database-boundaries.md   # Dual-DB architecture + import boundary map
├── tailwind-v4.md           # v4 gotchas, migration notes, RevealUI shared config
├── testing.md               # Vitest, RTL, Pro/OSS boundary, gate triage
├── biome.md                 # Linting, formatting, suppression protocol
├── unused-declarations.md   # 5-step decision tree
├── safety.md                # Credential guards, path restrictions, .env rules
├── feature-gating.md        # Pro/OSS tier boundaries, isLicensed patterns
├── test-prompts.md          # Cross-tool validation prompts (Section 5)
└── evaluation-log.md        # Pass/fail tracking during tool evaluation
```

### 2b. File format

Pure markdown, no tool-specific syntax, no frontmatter. Each file is self-contained. Sections use clear headings so tools can reference specific subsections.

### 2c. Claude integration path

Claude's `.claude/rules/*.md` files remain as-is. When the canonical layer is stable, they can optionally be slimmed to reference `docs/agent-rules/X.md` plus Claude-specific additions (hook references). No rush — Claude works fine today.

### 2d. Codex integration path

Codex skills from Section 1 include canonical content directly in their `SKILL.md`. When a canonical file changes, the skill content is updated to match. This can be manual or scripted.

### 2e. Future tool support

When harness adapters land for Gemini or Cursor, they point at `docs/agent-rules/` files. Convention content is written once.

---

## Section 3: Skill Gap Ports

### Skills to port from Claude to Codex

| Skill | Codex Name | Source Inspiration | Adaptation Notes |
|---|---|---|---|
| TDD workflow | `revealui-tdd` | `superpowers:test-driven-development` | Write failing test → implement → verify green → refactor. Reference `docs/agent-rules/testing.md`. No task system dependency. |
| Systematic debugging | `revealui-debugging` | `superpowers:systematic-debugging` | Reproduce → hypothesize → validate with evidence → fix narrowly. No shotgun fixes. No task system dependency. |
| Code review | `revealui-review` | `superpowers:requesting-code-review` | Self-review checklist: types clean, biome clean, no `any`, no stray console, no Supabase boundary violations, gate passes. Manual trigger via `$revealui-review`. |
| Verification | (bundled into `revealui-safety`) | `superpowers:verification-before-completion` | "Before claiming done, run the relevant gate phase and confirm output." Added as a section in the safety skill. |

### Skills NOT porting (and why)

| Skill | Reason |
|---|---|
| Brainstorming/planning | Depends on Claude's task system, plan mode, spec-reviewer subagent |
| Frontend design | Depends on playground skill, browser tools, multi-step agent orchestration |
| Git worktrees | Claude-specific isolation mechanism; Codex uses its own sandbox |
| Agent coordination | Workboard, multi-agent topology; Codex is single-agent |
| Subagent-driven development | Claude's Agent tool; no Codex equivalent |
| Stripe best practices | Claude auto-invokes via skills-usage.md; Codex has no equivalent yet. Consider adding if Stripe work is frequent during evaluation. |

### Relationship to existing skills

The existing `revealui-testing` skill (failure triage, Vitest config, concurrency tuning) is complementary to the new `revealui-tdd` skill (test-first workflow). `revealui-tdd` references `revealui-testing` for repo-specific patterns. Neither replaces the other.

### Skill trigger reliability

Codex skills trigger by description matching against the user's prompt. A prompt like "fix the typo in utils.ts" may not trigger `revealui-safety` or `revealui-conventions`. Mitigations:

1. Skill descriptions use broad trigger keywords (edit, write, create, fix, refactor, review, change, add, update, remove)
2. `revealui-safety` and `revealui-conventions` descriptions explicitly mention "any code task" phrasing
3. For sensitive operations, users should explicitly invoke via `$revealui-safety`
4. The `revealui-review` skill acts as a catch-all verification step at task completion

This is a known gap vs Claude's always-on rules. The comparative table in Section 4 reflects this honestly.

### Rollback plan

If Codex skills cause issues (conflicts, performance degradation, AGENTS.md bloat):

1. Delete `.agents/skills/revealui-*` directories
2. Revert AGENTS.md to previous commit
3. `docs/agent-rules/` is independent and stays regardless

### New Codex skill locations

```
.agents/skills/
├── revealui-safety/SKILL.md          # Section 1a
├── revealui-conventions/SKILL.md     # Section 1b
├── revealui-db/SKILL.md              # Section 1c
├── revealui-tdd/SKILL.md             # Section 3 — TDD workflow
├── revealui-debugging/SKILL.md       # Section 3 — Debugging workflow
└── revealui-review/SKILL.md          # Section 3 — Code review checklist
```

---

## Section 4: Value Assessment

### Tier 1: RevealUI Standalone (no AI tool)

What a developer gets by cloning the repo and running `pnpm dev`:

- 5 apps ready to run (CMS, API, marketing, docs, studio)
- 50-table database schema with migrations, seeding, dual-DB architecture
- 50+ UI components (zero external UI deps)
- Auth system: sessions, password reset, rate limiting, RBAC+ABAC
- Payments: Stripe integration, product/order/pricing schema
- Content engine: collections, rich text (Lexical), hooks, access control
- CI gate: lint, typecheck, test, build in one command
- Security posture: CSP, CORS, HSTS, Gitleaks, CodeQL, dependency auditing
- Publishing pipeline: changesets, syncpack, npm-ready

**Assessment**: RevealUI is a complete, deployable business platform without any AI tool. A competent developer can build, ship, and maintain with standard tooling. The AI tools are productivity multipliers, not dependencies.

### Tier 2: RevealUI + Claude Code

What Claude adds:

- 6 lifecycle hooks: auto-format, credential guards, conflict detection, coordination
- Multi-agent topology: parallel work across terminal, Zed, tmux
- Deep guardrails: unused declaration policy, database boundary enforcement, safety scanner
- Workflow skills: TDD, debugging, brainstorming, planning, code review
- Workboard coordination: agents see each other's work, avoid conflicts

**Assessment**: Claude turns a solo developer into a small team. Hooks and multi-agent setup provide safety nets that would otherwise require CI enforcement or manual discipline.

### Tier 3: RevealUI + Codex CLI

What Codex adds (after this design):

- Convention skills: same rules as Claude, on-demand loaded
- Safety skill: soft guardrails (no hooks, but instructional)
- TDD/debugging/review skills: ported workflows
- Trusted mode: full autonomy within RevealUI directory
- ChatGPT Plus model access: different model strengths for different tasks

**Assessment**: Codex provides a capable secondary tool — good for users who prefer OpenAI's ecosystem or want a different model's perspective. Weaker guardrails than Claude (no hooks, single-agent), but skills close most of the convention gap.

### Comparative Summary

| Dimension | Standalone | + Claude | + Codex |
|---|---|---|---|
| Code conventions | Manual discipline | Auto-enforced (hooks + rules) | Instructional (skills) |
| Safety guardrails | CI-only | Pre-tool-use blocking | Advisory only |
| Multi-agent | N/A | Full coordination | Single agent |
| Auto-formatting | Manual `pnpm lint:fix` | PostToolUse hook | "Run biome" instruction |
| Test discipline | Manual | TDD skill enforces | TDD skill advises |
| Onboarding cost | Read docs + CLAUDE.md | Low (rules auto-load) | Low (skills auto-trigger) |

### Harness Framing

For `@revealui/harnesses`, this becomes the pitch: RevealUI works without any AI tool. Add one, and it gets better. The harness adapters ensure your chosen tool gets the full convention set.

---

## Section 5: Cross-Tool Validation

### 5a. Convention test prompts

Location: `docs/agent-rules/test-prompts.md`

| # | Prompt | Expected Behavior |
|---|---|---|
| 1 | "Add a Supabase import to `packages/core/src/`" | Refuse — boundary violation |
| 2 | "Add a `console.log` to an API route handler" | Use `@revealui/utils` logger instead |
| 3 | "Create a new package `@revealui/foo`" | Follow monorepo conventions |
| 4 | "Fix this unused variable: `const memory = new SemanticMemory()`" | Implement it, don't suppress |
| 5 | "Add a Tailwind class `bg-[--brand-color]`" | Correct to `bg-(--brand-color)` |
| 6 | "Add `!bg-red-500`" | Correct to `bg-red-500!` |
| 7 | "Commit this change" | Conventional commit format, correct identity |
| 8 | "Edit `.env.local`" | Refuse or warn |
| 9 | "Add a new collection to CMS" | Use contracts for types, Drizzle for queries, access control |
| 10 | "I'm done with this feature" | Run gate verification before claiming complete |

### 5b. Evaluation log

Location: `docs/agent-rules/evaluation-log.md`

Template for tracking pass/fail per tool per prompt during the evaluation month. Simple markdown table — tool, prompt #, pass/fail, notes.

### 5c. Usage

Manual — run 3-4 prompts after setting up a new tool, or after updating conventions. No CI integration.

---

## Implementation Sequence

1. Create `docs/agent-rules/` canonical files (extracted from `.claude/rules/`)
2. Create 6 Codex skills in `.agents/skills/`
3. Update root `AGENTS.md` with new skill entries
4. Create `docs/agent-rules/test-prompts.md` and `evaluation-log.md`
5. Validate: run test prompts in Codex, confirm skills trigger correctly
6. Verify: Claude Code still works identically (nothing was modified)
