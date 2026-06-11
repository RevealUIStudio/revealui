---
title: "RevealUI"
description: "RevealUI is the agentic business runtime. Users, content, products, payments, and AI - pre-wired, open source, and ready to deploy."
visibility: public
status: verified
audience: agent
---

# RevealUI

RevealUI is the agentic business runtime. Users, content, products, payments, and AI  -  pre-wired, open source, and ready to deploy.

## Five Primitives

1. **Users**  -  authentication, sessions, RBAC/ABAC, rate limiting, brute force protection
2. **Content**  -  collections, rich text (Lexical), media, draft/live workflows, REST API
3. **Products**  -  catalog, pricing tiers, license key management
4. **Payments**  -  Stripe checkout, subscriptions, webhooks, billing portal
5. **Intelligence**  -  AI agents, CRDT memory, open-model inference, orchestration (Pro tier)

## Stack

- React 19, Next.js 16, Node 24, TypeScript 6
- Hono (REST API with OpenAPI), Drizzle ORM (NeonDB)
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

14 MCP servers ship with RevealUI — ground-truth count from `packages/mcp/src/servers/`, enforced by `pnpm validate:claims`:

**External integrations:** Stripe, Supabase, Neon, Vercel, Playwright
**Developer tools:** Code Validator, Next.js DevTools, Vultr Test
**RevealUI-native:** Content, Email, Memory, Stripe-RevealUI
**Adapter framework:** (shared across the above)

Full details in `docs/PRO.md`.

## License

- **OSS (MIT):** @revealui/auth, @revealui/cache, @revealui/cli, @revealui/config, @revealui/contracts, @revealui/core, @revealui/db, @revealui/dev, @revealui/openapi, @revealui/paywall, @revealui/presentation, @revealui/resilience, @revealui/router, @revealui/security, @revealui/setup, @revealui/sync, @revealui/utils, plus create-revealui, revealui, and test
- **Pro packages (FSL-1.1-MIT, source-available):** @revealui/ai, @revealui/engines, @revealui/harnesses, @revealui/mcp, @revealui/services
- **Internal (no published license):** @revealui/scripts

## Pricing Tiers

| Tier | Price | Limits |
|------|-------|--------|
| free | $0 | 1 site, 3 users, 200 req/min |
| pro | $49/mo | 5 sites, 25 users, 300 req/min |
| max | $299/mo | 15 sites, 100 users, 600 req/min |
| enterprise | $1,499/mo | unlimited |

## Quickstart

```bash
npm create revealui
```

---

## Skills

A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.

### Available skills

- next-best-practices: Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling (file: /home/joshua-v-dev/revfleet/revskills/skills/next-best-practices/SKILL.md)
- vitest-testing: Vitest fast unit testing framework — mocking, coverage, test filtering, fixtures. Use when writing or debugging tests in this repo. (file: /home/joshua-v-dev/revfleet/revskills/skills/vitest-testing/SKILL.md)
- tailwind-v4: Tailwind CSS v4 migration and usage patterns. Use when writing or auditing Tailwind v4 utility classes. (file: /home/joshua-v-dev/revfleet/revskills/skills/tailwind-v4/SKILL.md)
- drizzle-db: Drizzle ORM patterns — schema definitions, migrations, queries. Use for any NeonDB / Postgres work in this repo. (file: /home/joshua-v-dev/revfleet/revskills/skills/drizzle-db/SKILL.md)
- electric-sync: ElectricSQL real-time sync integration. Use when working on `@revealui/sync` or Electric shape subscriptions. (file: /home/joshua-v-dev/revfleet/revskills/skills/electric-sync/SKILL.md)
- mcp-server: MCP server authoring and adapter patterns. Use when building or debugging MCP servers in `packages/mcp`. (file: /home/joshua-v-dev/revfleet/revskills/skills/mcp-server/SKILL.md)
- multi-agent-memory: Multi-agent CRDT memory patterns. Use for `@revealui/ai` memory and A2A coordination work. (file: /home/joshua-v-dev/revfleet/revskills/skills/multi-agent-memory/SKILL.md)
- security-hardening: Security hardening checklist for this codebase. Use when reviewing auth, headers, access control, or cryptography. (file: /home/joshua-v-dev/revfleet/revskills/skills/security-hardening/SKILL.md)
- yjs-collaboration: Yjs collaborative editing patterns. Use when working on real-time collaborative features backed by CRDT. (file: /home/joshua-v-dev/revfleet/revskills/skills/yjs-collaboration/SKILL.md)
- revealui-doctor: Environment and dependency health check for RevealUI. Use to diagnose setup issues or verify dev environment state. (file: /home/joshua-v-dev/revfleet/revskills/skills/revealui-doctor/SKILL.md)
- revealui-handoff: Session handoff notes. Use to leave structured context for the next Claude Code session. (file: /home/joshua-v-dev/revfleet/revskills/skills/revealui-handoff/SKILL.md)
- revealui-recover: Recovery workflow for interrupted sessions or broken states. (file: /home/joshua-v-dev/revfleet/revskills/skills/revealui-recover/SKILL.md)
- revealui-sync-lts: Sync repos on LTS drive with GitHub. Use when running the weekly LTS backup pipeline. (file: /home/joshua-v-dev/revfleet/revskills/skills/revealui-sync-lts/SKILL.md)
- revealui-sync-rules: Sync RevCon harness rule files across agents. Use when rules in `revcon/harnesses/rules/` change. (file: /home/joshua-v-dev/revfleet/revskills/skills/revealui-sync-rules/SKILL.md)

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
