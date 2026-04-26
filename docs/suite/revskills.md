---
title: "RevSkills"
description: "Curated Agent Skills for modern web development. Compatible with Claude Code, Cursor, and any tool supporting the Agent Skills standard."
category: suite
audience: developer
---

# RevSkills

**Curated [Agent Skills](https://agentskills.io) for modern web development. Built by RevealUI Studio.**

> RevSkills is a separate suite product. The repo is at [RevealUIStudio/revskills](https://github.com/RevealUIStudio/revskills). This page summarises what RevSkills is; the canonical product README lives in the RevSkills repo.

## What RevSkills is

A curated collection of **`SKILL.md`-format Agent Skills** packaged for distribution. Compatible with:

- **Claude Code** — load skills via the agent-skills standard
- **Cursor** — same SKILL.md format
- **Any tool** supporting the Agent Skills standard at [agentskills.io](https://agentskills.io)

Each skill is independently versioned (per the suite-wide pre-1.0 SemVer rule) and reviewed before publication.

## Install

```bash
# All skills
npx skills add RevealUIStudio/revskills

# Single skill
npx skills add RevealUIStudio/revskills --skill next-best-practices
```

## What's in the catalog

The RevSkills repo organises skills by surface area. Representative entries (the canonical list lives in the RevSkills repo `skills/` directory):

### Framework + app patterns

- **`next-best-practices`** — Next.js 15+ App Router (RSC, PPR, caching, server actions, metadata)
- **`tailwind-v4`** — Tailwind CSS v4 (`@theme`, CSS-first config, CVA, migration from v3)
- **`security-hardening`** — OWASP Top 10 (CSP, CORS, auth, rate limiting, XSS, CSRF)

### Data + sync

(See the RevSkills repo for the full per-skill list — this is a representative sample, not exhaustive.)

## How it composes with RevealUI

- **Agents working inside RevealUI repos** inherit consistent behaviour by loading the relevant RevSkills entries — no per-developer skill duplication.
- **Cross-suite consistency**: the same skills are loaded into RevealUI, RevDev, RevVault, Forge etc. when an agent works against any suite product.
- **Pairs with RevCon**: RevCon ships the *symlink mechanism* for editor configs and rule files; RevSkills ships the *content* of agent skills. Together they give a new contributor the full agent posture in one bootstrap.

## Status

Active.

## See also

- [Suite overview](../SUITE) — how RevSkills relates to the rest of the suite
- [RevCon](./revcon) — symlink machinery for editor configs and agent rules
- [RevSkills README](https://github.com/RevealUIStudio/revskills/blob/main/README.md) — canonical product docs
- [agentskills.io](https://agentskills.io) — the upstream Agent Skills standard
