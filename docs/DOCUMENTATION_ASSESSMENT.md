# Documentation vs Reality Assessment

_Generated: 2026-03-28 | Branch: develop | Commit: ce5f1ea8_

Brutally honest audit of what RevealUI documentation claims versus what the codebase actually delivers.

---

## Executive Summary

RevealUI's core framework is **real and production-grade** — auth, billing, CMS engine, 50+ UI components, 75-table database, 10,784+ tests. The documentation is mostly accurate but has version drift, stale counts, broken internal links, and a few areas where aspirational language outpaces implementation. The biggest gaps are in examples (3 of 6 are README-only), ElectricSQL sync (basic), and Forge self-hosting (infrastructure skeletons only).

---

## Factual Errors in Documentation

### Version & Count Drift

| Claim | Where | Actual | Fix |
|-------|-------|--------|-----|
| TypeScript 5.9 | README badge | **6.0.2** | Update badge |
| 68 database tables | README, CLAUDE.md, QUICK_START | **75 pgTable declarations** | Update all references |
| 6 apps | README | **7** (revealcoin app undocumented) | Add revealcoin or note it as experimental |
| Node.js 24.0 | README/badges | **24.13.0** (.node-version) | Minor — acceptable |

### Broken Internal References (CONTRIBUTING.md)

| Line | Reference | Status |
|------|-----------|--------|
| 16 | `docs/TYPE-SYSTEM-RULES.md` | **File does not exist** |
| 27 | `docs/AI-AGENT-RULES.md` | **File does not exist** |
| 86 | `docs/MIGRATION_GUIDE.md` | **File does not exist** |
| 159 | `docs/LINTING_RULES.md` | **File does not exist** |

---

## Feature Claims: Verified Status

### Accurately Documented (no action needed)

| Feature | Evidence |
|---------|----------|
| React 19 | `react@^19.2.3` in package.json |
| Next.js 16 | Catalog reference, App Router throughout |
| 50+ UI components | **56 components** in presentation package |
| Session-only auth (no JWT) | bcrypt-12, RBAC/ABAC, 2FA, WebAuthn, OAuth |
| Stripe checkout/subscriptions/webhooks | 1,100-line webhook handler, 12 event types |
| Drizzle ORM dual-DB (NeonDB + Supabase) | Schema + queries + boundary enforcement |
| Biome 2 linting | Pre-commit hooks, CI hard-fail |
| 10,784+ tests | Vitest + Playwright, passing in CI |
| MCP servers | 12 server files in packages/mcp/src/servers/ |
| Content layer | 29 canonical definitions, byte-identical generation |

### Understated in Documentation (better than claimed)

| Feature | Docs say | Reality |
|---------|----------|---------|
| Database tables | 68 | **75** |
| UI components | 50+ | **56** |
| Doc guides | 25 | **25 root + 7 subdirectories** with additional files |
| x402 payments | PRO.md describes protocol | **385-line middleware** with USDC + RVUI verification, gated behind env var |
| CMS agent chat | ROADMAP marks as done | Full implementation: `/api/chat`, `/api/agent-stream`, admin UI with agent selection, conversation persistence |

### Overstated or Aspirational

| Feature | Docs say | Reality | Gap |
|---------|----------|---------|-----|
| Stripe billing | "Pre-wired payments" | Code complete but **TEST MODE only** | Live mode pending manual UX verification |
| ElectricSQL sync | "Real-time collaborative editing" | Package exists, marked "basic" in CHANGELOG | Not production-ready |
| Forge self-hosting | "Docker + K8s + Terraform" | Infrastructure skeletons exist | No SSO, no white-label, no deployment guide |
| Agent Marketplace | Schema + routes documented | DB tables + API routes exist | Not functional end-to-end |
| Example projects | 6 examples listed | **3 of 6 are README-only** (basic-blog, e-commerce, portfolio) | Missing working code |

---

## Examples Directory Audit

| Directory | Contents | Verdict |
|-----------|----------|---------|
| `examples/agent/` | 1 HTML file (electric-demo) | Minimal |
| `examples/api/` | OpenAPI spec JSON (479KB) | Reference only |
| `examples/basic-blog/` | README only | **No working code** |
| `examples/code-examples/` | 3 TypeScript files | Real code |
| `examples/e-commerce/` | README only | **No working code** |
| `examples/portfolio/` | README only | **No working code** |
| `examples/server/` | 1 TypeScript file | Minimal |

Note: `npx create-revealui` scaffolds a working basic-blog from npm templates — the `examples/` directory versions are stale stubs.

---

## Root Directory Hygiene

### Tracked files that should be removed

| File | Size | Issue |
|------|------|-------|
| `DEPENDENCY_DIAGRAM.txt` | 15KB | Generated artifact, stale (Feb 14) |
| `TYPE-USAGE-REPORT.json` | 108KB | Generated artifact, stale (Feb 14) |
| `CODE-QUALITY-REPORT.json` | 24KB | In .gitignore but still git-cached |
| `skills-lock.json` | 1.4KB | Claude Code internal lockfile |

### Directories to evaluate

| Directory | Issue | Recommendation |
|-----------|-------|---------------|
| `cmd/` (Go CLI) | Superseded by `apps/terminal/` + `@revealui/cli` | ✅ Deleted |
| `bin/revealui` | Shell wrapper for dead Go CLI | ✅ Deleted |
| `infrastructure/opencode-server/` | Pre-RevealUI project, not referenced anywhere | ✅ Deleted |
| `examples/basic-blog/`, `e-commerce/`, `portfolio/` | README-only stubs | ✅ Deleted |
| `.env.template` + `.env.example` | Two overlapping env example files | ✅ Merged into `.env.template` |
| `e2e/` (root) vs `packages/test/src/e2e/` | E2E tests in two locations | ✅ Kept — different purposes (production vs package reference) |

### Config files to evaluate

| File | Issue |
|------|-------|
| `.size-limit.json` | size-limit not in any CI pipeline or script |
| `docker-compose.forge.yml` | Forge self-hosting deferred — premature? |
| `CHANGELOG.md` | Only covers v0.1.0 (Mar 3). Changesets should auto-generate. |

---

## Pro Tier Reality Check

| Package | Docs claim | Actual state | Completeness |
|---------|-----------|--------------|-------------|
| `@revealui/ai` | AI agents, memory, LLM orchestration | 40+ files, 18 import subpaths, real agents | ~80% |
| `@revealui/mcp` | 6 MCP servers | **12 server files** (more than claimed) | ~90% |
| `@revealui/harnesses` | AI coordination, workboard | 196 tests, JSON-RPC 2.0, content layer | ~95% |
| `@revealui/editors` | Editor config sync | 20+ files, 6 test files | ~70% |
| `@revealui/services` | Stripe + Supabase integrations | 354 tests passing | ~85% |

Overall Pro tier: **~80% complete** (not 50% as a surface scan might suggest).

---

## Licensing Accuracy

| Tier | Price | Documented features | Implementation |
|------|-------|-------------------|----------------|
| Free (MIT) | $0 | Full core, 1 site, 3 users | Complete |
| Pro | $49/mo | AI agents, BYOK, MCP, 5 sites | ~80% |
| Max | $149/mo | Multi-provider AI, audit, 15 sites | ~70% |
| Enterprise/Forge | $299/mo | White-label, SSO, self-hosted | ~30% |

---

## Recommendations

### Must Fix (misrepresents current state)

1. **TypeScript version badge**: 5.9 -> 6 in README
2. **Table count**: 68 -> 75 everywhere
3. **Broken CONTRIBUTING.md links**: 4 references to non-existent docs
4. **Examples directory**: Either populate the 3 empty examples or remove them

### Should Fix (confusing but not misleading)

5. ~~**Merge `.env.template` + `.env.example`**~~: ✅ Merged into single `.env.template`
6. ~~**Delete dead code**~~: ✅ `cmd/`, `bin/revealui`, `infrastructure/opencode-server/` deleted
7. ~~**Consolidate E2E tests**~~: ✅ Kept separate — root `e2e/` (production full-stack) vs `packages/test/src/e2e/` (package reference tests) serve different purposes
8. ~~**Remove stale generated files**~~: ✅ Removed

### Nice to Have

9. **Document `apps/revealcoin`**: 7th app exists but isn't mentioned
10. **Clarify ElectricSQL status**: "Basic" sync should be explicitly noted
11. **Clarify Forge timeline**: Infrastructure exists but isn't deployable yet
12. **Auto-generate CHANGELOG**: Current one is manually maintained and stale
