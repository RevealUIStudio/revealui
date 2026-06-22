---
title: "One Runtime, Eight Products: The RevFleet Family"
description: "You do not adopt a framework, you adopt a fleet. RevealUI is the flagship runtime, and seven sister products extend it."
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

Most tools sell you a library. You install it, wire it into one corner of your app, and move on. RevealUI is built the other way around. It is a runtime that an entire family of products sits on top of, each one solving a problem you hit the moment you start running software for real.

We call the family RevFleet. RevealUI is the flagship: the agentic business runtime that gives you users, content, products, payments, and intelligence pre-wired into one deployable system. The other seven products are the tools we built to operate it, and we ship every one of them.

This post is the map. It is also honest about where each product is, because "shipping" means different things at different stages, and you deserve to know which is which before you build on it.

## How we label maturity

Every product carries one of four status badges. They mean exactly what they say:

- **Beta** -- production-ready code, dogfooded daily, limited real users.
- **Alpha** -- works and ships, development-preview quality, may break.
- **Active (MIT)** -- a released, free, open library, no support guarantees.
- **Planned** -- code-complete or scaffolded, not yet shipped to users.

No product on this page hides behind a vaguer word than that.

## The flagship: RevealUI

**RevealUI** (Beta) is the foundation everything else builds on. The five primitives, users, content, products, payments, and intelligence, are pre-wired into a single runtime that your team and your AI agents share through one open protocol. Standard Postgres for data, S3-compatible object storage, real-time sync, a typed REST API with an OpenAPI spec, session auth, and feature gating, all in the box.

You can run a real business on the open-source core today. Start here. Add the rest of the fleet as you grow into it.

```bash
npx create-revealui@latest my-app
```

## The seven sister products

Each of these came out of operating RevealUI ourselves. We needed them, so we built them, then made them products.

**RevVault** (Beta) is an age-encrypted secret vault. A Rust CLI plus a Tauri desktop app keep your credentials encrypted on hardware you control, never in a vendor dashboard and never as plaintext on disk. It is the canonical secret store for every project in the fleet. There is a whole post on why your secrets do not belong in a `.env` file.

**RevForge** (Beta) is a white-label stamping tool for operators. It generates branded, domain-locked RevealUI trial kits as self-hosted runtime instances, so an agency or platform can hand a customer their own deployment without forking anything by hand.

**RevDev** (Alpha) is a multi-agent IDE harness: a desktop Studio, a terminal Console, and a Node daemon that coordinate AI coding agents across a multi-repo workspace. It speaks to Claude, Cursor, and Copilot through a shared coordination layer. Alpha means it works and we use it, not that it is bulletproof yet.

**RevCon** (Alpha) is editor config sync. One source of truth for Zed, VS Code, and Cursor settings, symlinked into every project, so you edit a config once and it propagates fleet-wide.

**RevSkills** (Active, MIT) is a library of Claude Code skills: auth flows, schema patterns, test scaffolds, and more, ready to drop into any agent. Free, open, importable.

**RevKit** (Active, MIT) is a portable developer environment. Profile-based bootstrap with parameterized templates and tier-aware configs, so a new machine comes up reproducible instead of hand-assembled.

**RevMarket** (Planned) is the agent tool marketplace. The runtime already ships a catalog of first-party integrations out of the box; RevMarket is the planned layer where third-party developers publish and discover MCP servers and agent capabilities. It is designed, not yet open to outside publishers, and we say so plainly on the roadmap.

## Why a fleet instead of one big product

The temptation, building this, was to fold everything into one monolith and call it a platform. We did the opposite on purpose.

Each product is useful on its own. RevVault secures secrets for any project, RevealUI runtime or not. RevSkills drops into any Claude Code setup. RevKit bootstraps any developer machine. Bundling them would have made each one worse, locked behind a runtime you may not want yet.

So they compose instead of couple. You can take exactly the piece you need today, and the rest is there when you need it. One foundation, eight products, no all-or-nothing.

---

*RevealUI is the open runtime for businesses that run their own AI. See the whole RevFleet lineup and current status at [revealui.com/products](https://revealui.com/products), or start with the runtime: `npx create-revealui`.*
