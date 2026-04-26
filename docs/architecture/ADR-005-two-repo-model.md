# ADR-005: Two-Repo Model (Public + Private Coordination Hub)

**Date:** 2026-04-08
**Status:** Accepted

## Context

RevealUI started as a single private monorepo (`revealui-jv`) containing all code, business docs, and planning. When the project went public, the repo was forked into a public repo (`RevealUI`) with Pro packages gitignored. Over time, the private repo accumulated stale code copies, sync friction, and confusion about which repo was authoritative.

After adopting Fair Source licensing (ADR-003), all source code moved to the public repo. The private repo needed a new purpose or deletion.

## Decision

**Two independent repos, no git-level coupling:**

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `RevealUIStudio/revealui` (public) | Public | All code: OSS (MIT) + Pro (FSL-1.1-MIT). Apps, packages, scripts, public docs. |
| `RevealUIStudio/revealui-jv` (private) | Private | Internal coordination hub: MASTER_PLAN, feature gaps, roadmap, business docs, agent workboard. |

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
- **Delete revealui-jv**: The private repo still serves a purpose as the single source of truth for planning and agent coordination. Deleting it would scatter this information across GitHub issues, which are public.
- **Git submodules**: Rejected outright. Submodules add complexity to cloning, CI, and contributor onboarding for marginal benefit. The user has explicitly prohibited their use.

## Consequences

- Contributors only need the public repo. The private repo is founder-only.
- MASTER_PLAN updates require a separate commit to the private repo (agents handle this automatically via the coordination protocol)
- No sync scripts, no code duplication between repos
- The private repo is lightweight — markdown plans, gap trackers, and business documents
