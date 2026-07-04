---
title: "ADR-005: Two-Repo Model (Public + Private Coordination Hub)"
description: "**Date:** 2026-04-08"
visibility: public
status: verified
audience: user
---

**Date:** 2026-04-08
**Status:** Superseded by the four-repo model (2026-05-18) — see note below

> **⚠️ Superseded — preserved for history.** The two-repo split has since expanded into a **four-repo model**: **revealui** (public framework — OSS MIT + Pro FSL-1.1-MIT), **agency** (public marketing site, `revealuistudio.com`), **revmarket** (transactional MCP-marketplace venue — a separate trust boundary; staged inside `revealui/packages/marketplace-*` until its own repo is created), and a **private coordination hub**. The framework-vs-venue split is an owner-locked architecture decision (2026-05-18). The public-framework + private-coordination rationale below still holds for the public-framework ↔ private-hub pair.

## Context

RevealUI started as a single private monorepo containing all code, business docs, and planning. When the project went public, the repo was forked into a public repo (`RevealUI`) with Pro packages gitignored. Over time, the private repo accumulated stale code copies, sync friction, and confusion about which repo was authoritative.

After adopting Fair Source licensing (ADR-003), all source code moved to the public repo. The private repo needed a new purpose or deletion.

## Decision

**Two independent repos, no git-level coupling:**

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `RevealUIStudio/revealui` (public) | Public | All code: OSS (MIT) + Pro (FSL-1.1-MIT). Apps, packages, scripts, public docs. |
| Private coordination hub | Private | Internal coordination hub: MASTER_PLAN, feature gaps, roadmap, business docs, agent workboard. |

### What lives where

- **All code** (OSS + Pro): public repo
- **Public docs** (architecture, guides, agent rules, ADRs): public repo
- **MASTER_PLAN, gaps, roadmap**: private repo (business-sensitive timelines)
- **Business plan, pitch deck, sales**: private repo
- **Agent coordination** (workboard, rules): private repo

### No submodules

The repos are fully independent. No submodules, no git-level coupling. Coordination happens through convention (both repos share the same agent / editor convention rules) and a shared workboard protocol.

## Alternatives Considered

- **Single public repo**: Moving MASTER_PLAN and business docs into the public repo. Rejected because release timelines, pricing strategy, and agency outreach templates are competitively sensitive.
- **Delete the private hub repo**: The private repo still serves a purpose as the single source of truth for planning and agent coordination. Deleting it would scatter this information across GitHub issues, which are public.
- **Git submodules**: Rejected outright. Submodules add complexity to cloning, CI, and contributor onboarding for marginal benefit. The user has explicitly prohibited their use.

## Consequences

- Contributors only need the public repo. The private repo is founder-only.
- MASTER_PLAN updates require a separate commit to the private repo (agents handle this automatically via the coordination protocol)
- No sync scripts, no code duplication between repos
- The private repo is lightweight — markdown plans, gap trackers, and business documents
