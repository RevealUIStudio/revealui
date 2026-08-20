---
title: "Guides"
description: "Practical, step-by-step guides for building with RevealUI."
visibility: public
status: verified
audience: user
---

Practical, step-by-step guides for building with RevealUI.

---

## Getting Started

- [Quick Start](../QUICK_START.md) -- Get RevealUI running locally in 15 minutes

## Core Guides

- [Authentication](./authentication.md) -- Session auth, OAuth providers, password reset, rate limiting
- [Collections](./collections.md) -- Define collections, field types, access control, hooks
- [Billing](./billing.md) -- Stripe checkout, subscriptions, webhooks, pricing tiers
- [Deployment](./deployment.md) -- Vercel, Docker, self-hosted, environment variables
- [Collaborative editing](./collaborative-editing.md) -- Yjs + Lexical cursors for self-hosted operators
- [Admin development](./admin-dev.md) -- Turbopack HMR expectations
- [Errors and debugging](./errors-and-debugging.md) -- API error envelope and bug reports

## Connect editors (governed agents)

- [Connect OpenCode](./connect-opencode.md) -- OpenCode CLI via governed MCP
- [Connect Cursor](./connect-cursor.md) -- Cursor hooks + governed MCP
- [Connect VS Code](./connect-vscode.md) -- Copilot agent plugin bundle
- [Connect ACP (Zed / JetBrains)](./connect-acp.md) -- `revealui-harnesses acp` on stdio

Maintainer residual (GAP-381 Phase E / D-C / D-D) is monorepo-only under
`docs/runbooks/` (visibility: internal; not linked here so the public docs
site never 404s). Automated smoke: `pnpm exec tsx scripts/validate/gap-381-phase-e-smoke.ts`.

## Reference

For package-level API documentation, see the [API Reference](/api).

For the full documentation index, see the [Documentation Home](/index).
