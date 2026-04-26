---
title: "RevDev"
description: "Native developer tools for RevealUI: Studio (Tauri 2 desktop) and Console (Go SSH TUI), backed by a shared harness daemon."
category: suite
audience: developer
---

# RevDev

**Native developer tools for [RevealUI](https://github.com/RevealUIStudio/revealui). One product, two interfaces.**

> RevDev is a separate suite product, not part of the RevealUI monorepo. The repo is at [RevealUIStudio/revdev](https://github.com/RevealUIStudio/revdev). This page summarises what RevDev is and how it composes with RevealUI; the canonical product README lives in the RevDev repo.

## What RevDev ships

| Interface | Stack | Use case |
|---|---|---|
| **Studio** | Tauri 2 + React 19 (desktop) | AI editor + agent coordination dashboard. Visual hypervisor view, agent task feed, manual approvals, tool routing. Daily-driver UI for someone running RevealUI agents. |
| **Console** | Go + Bubble Tea (SSH TUI) | Ops cockpit. Agent health, deploys, billing, alerts. Designed to run inside an SSH session for production triage. |
| **Harness Daemon** | Node.js | Shared backend for both UIs. Coordinates AI agents, manages PTY sessions, routes JSON-RPC tool calls. Talks to the RevealUI API (Hono on Vercel) for everything customer-data-shaped. |

```
┌─────────┐     ┌──────────┐
│ Studio  │     │ Console  │
│ (Tauri) │     │   (Go)   │
└────┬────┘     └────┬─────┘
     │   JSON-RPC    │
     └───────┬───────┘
             │
     ┌───────┴────────┐
     │ Harness Daemon  │
     │   (Node.js)     │
     └───────┬────────┘
             │
     ┌───────┴────────┐
     │  RevealUI API   │
     │ (Hono / Vercel) │
     └────────────────┘
```

## How it composes with RevealUI

- **Studio talks to your RevealUI deployment.** Point Studio at `https://your-api.example.com`; Studio reads agent tasks, marketplace transactions, license state, and content collections through the RevealUI API.
- **The harness daemon is where Claude Code / Cursor / other AI agents plug in.** Agents launched from Studio use the daemon's JSON-RPC tool registry to call RevealUI primitives (sign in as a user, create a content row, refund a charge, publish an MCP server, etc.).
- **A RevealUI Pro license unlocks Studio's commercial features.** The harness daemon and Studio shell are usable against any RevealUI install (including the OSS-only Free tier); Pro-tier interactions (RAG, multi-agent orchestration, billing dashboards) require a Pro license at runtime.
- **Console is the right tool for production incidents.** When you're on-call and SSH'd into a jump box, you don't want a desktop GUI — Console gives you the same agent / deploy / billing telemetry over a TUI.

## Status

Active. Pre-launch (no published binaries). The harness daemon is documented in the RevDev repo's `apps/harness/` tree; Studio in `apps/studio/`; Console in `apps/console/`.

## See also

- [RevealUI Pro overview](../PRO) — what the Pro tier unlocks (including Studio's Pro features)
- [Suite overview](../SUITE) — how RevDev relates to the rest of the suite
- [RevDev README](https://github.com/RevealUIStudio/revdev/blob/main/README.md) — canonical product docs
