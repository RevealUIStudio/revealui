# RevealUI

RevealUI is Business Operating System Software (B.O.S.S.) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

## Five Primitives

1. **Users** — authentication, sessions, RBAC/ABAC, rate limiting, brute force protection
2. **Content** — collections, rich text (Lexical), media, draft/live workflows, REST API
3. **Products** — catalog, pricing tiers, license key management
4. **Payments** — Stripe checkout, subscriptions, webhooks, billing portal
5. **Intelligence** — AI agents, CRDT memory, LLM orchestration, BYOK (Pro tier)

## Stack

- React 19, Next.js 16, Node 24, TypeScript 5.9
- Hono (REST API with OpenAPI), Drizzle ORM (NeonDB + Supabase)
- Stripe (payments), Tailwind CSS v4, Lexical (rich text), ElectricSQL (sync)
- pnpm 10, Turborepo, Biome 2, Vitest 4

## Discovery URLs

| Endpoint | URL |
|----------|-----|
| REST API | `https://api.revealui.com` |
| OpenAPI spec | `https://api.revealui.com/openapi.json` |
| Swagger UI | `https://api.revealui.com/docs` |
| A2A Agent Card | `https://api.revealui.com/.well-known/agent.json` |
| Documentation | `https://docs.revealui.com` |

## MCP Servers

Stripe, Supabase, Neon, Vercel, Code Validator, Playwright, Next.js DevTools

## License

- **OSS (MIT):** core, contracts, db, auth, presentation, router, config, utils, cli, setup, sync, cache, resilience, security, mcp, services
- **Commercial (source-available):** ai, editors, harnesses

## Pricing Tiers

| Tier | Price | Limits |
|------|-------|--------|
| free | $0 | 1 site, 3 users, 200 req/min |
| pro | $49/mo | 5 sites, 25 users, 300 req/min |
| max | $149/mo | 15 sites, 100 users, 600 req/min |
| enterprise (Forge) | $299/mo | unlimited |

## Quickstart

```bash
npm create revealui
```

---

## Skills

A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.

### Available skills

- next-best-practices: Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/next-best-practices/SKILL.md)
- next-cache-components: Next.js 16 Cache Components - PPR, use cache directive, cacheLife, cacheTag, updateTag (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/next-cache-components/SKILL.md)
- turborepo: Turborepo monorepo build system guidance. Triggers on: turbo.json, task pipelines, dependsOn, caching, remote cache, the "turbo" CLI, --filter, --affected, CI optimization, environment variables, internal packages, monorepo structure/best practices, and boundaries. Use when user: configures tasks/workflows/pipelines, creates packages, sets up monorepo, shares code between apps, runs changed/affected packages, debugs cache, or has apps/packages directories. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/turborepo/SKILL.md)
- vercel-composition-patterns: React composition patterns that scale. Use when refactoring components with boolean prop proliferation, building flexible component libraries, or designing reusable APIs. Triggers on tasks involving compound components, render props, context providers, or component architecture. Includes React 19 API changes. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/vercel-composition-patterns/SKILL.md)
- vercel-deploy: Deploy an app to Vercel. Only invoke when explicitly asked to deploy. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/vercel-deploy/SKILL.md)
- vercel-react-best-practices: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/vercel-react-best-practices/SKILL.md)
- web-design-guidelines: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/web-design-guidelines/SKILL.md)
- revealui-testing: RevealUI monorepo testing rules and failure-triage guidance. Use when changing tests, fixing flaky suites, adjusting Vitest config, debugging Turbo test failures, handling React Testing Library warnings, or deciding between scoped timeouts, worker limits, and test refactors in this repo. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-testing/SKILL.md)
- revealui-safety: RevealUI safety guardrails for any code task — editing, writing, creating, fixing, refactoring files. Protects credentials, enforces import boundaries, ensures code quality, and verifies work before completion. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-safety/SKILL.md)
- revealui-conventions: RevealUI coding conventions for any code task — TypeScript strict mode, ES Modules, Biome formatting, Tailwind v4 syntax, conventional commits, monorepo workspace protocol, feature gating, parameterization, and unused declaration policy. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-conventions/SKILL.md)
- revealui-db: RevealUI database conventions for tasks involving database, schema, query, migration, Drizzle ORM, Supabase, NeonDB, PostgreSQL, vectors, embeddings, or data modeling. Enforces dual-database architecture boundaries. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-db/SKILL.md)
- revealui-tdd: Test-driven development workflow for RevealUI — write-test-first, red-green-refactor cycle with Vitest and React Testing Library. Use when implementing features or fixing bugs. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-tdd/SKILL.md)
- revealui-debugging: Systematic debugging workflow for RevealUI — reproduce, hypothesize, validate, fix narrowly. Use when encountering bugs, test failures, or unexpected behavior. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-debugging/SKILL.md)
- revealui-review: Code review checklist for RevealUI — type safety, code quality, architecture, Tailwind v4, git conventions. Invoke with $revealui-review before committing. (file: /home/joshua-v-dev/projects/RevealUI/.agents/skills/revealui-review/SKILL.md)
- react-testing-library: React Testing Library: user-centric component testing with queries, user-event simulation, async utilities, and accessibility-first API. Use when writing React component tests, selecting elements by role/label/text, simulating user events, or testing async UI behavior. Keywords: React Testing Library, @testing-library/react, user-event, queries, render. (file: /home/joshua-v-dev/.agents/skills/react-testing-library/SKILL.md)
- vitest: Vitest fast unit testing framework powered by Vite with Jest-compatible API. Use when writing tests, mocking, configuring coverage, or working with test filtering and fixtures. (file: /home/joshua-v-dev/.agents/skills/vitest/SKILL.md)
- skill-creator: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations. (file: /home/joshua-v-dev/.codex/skills/.system/skill-creator/SKILL.md)
- skill-installer: Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos). (file: /home/joshua-v-dev/.codex/skills/.system/skill-installer/SKILL.md)

### How to use skills

- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.
- Trigger rules: If the user names a skill (with `$SkillName` or plain text) OR the task clearly matches a skill's description shown above, you must use that skill for that turn. Multiple mentions mean use them all. Do not carry skills across turns unless re-mentioned.
- Missing/blocked: If a named skill isn't in the list or the path can't be read, say so briefly and continue with the best fallback.
- How to use a skill (progressive disclosure):
  1. After deciding to use a skill, open its `SKILL.md`. Read only enough to follow the workflow.
  2. When `SKILL.md` references relative paths (e.g., `scripts/foo.py`), resolve them relative to the skill directory listed above first, and only consider other paths if needed.
  3. If `SKILL.md` points to extra folders such as `references/`, load only the specific files needed for the request; don't bulk-load everything.
  4. If `scripts/` exist, prefer running or patching them instead of retyping large code blocks.
  5. If `assets/` or templates exist, reuse them instead of recreating from scratch.
- Coordination and sequencing:
  - If multiple skills apply, choose the minimal set that covers the request and state the order you'll use them.
  - Announce which skill(s) you're using and why (one short line). If you skip an obvious skill, say why.
- Context hygiene:
  - Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
  - Avoid deep reference-chasing: prefer opening only files directly linked from `SKILL.md` unless you're blocked.
  - When variants exist (frameworks, providers, domains), pick only the relevant reference file(s) and note that choice.
- Safety and fallback: If a skill can't be applied cleanly (missing files, unclear instructions), state the issue, pick the next-best approach, and continue.
