---
title: "Fair Source"
description: "How RevealUI Pro packages are licensed under FSL-1.1-MIT, what you can and cannot do with them, and how each release auto-converts to plain MIT after two years."
category: reference
audience: developer
---

# Fair Source

The narrative version of this page lives at [revealui.com/fair-source](https://revealui.com/fair-source). This document is the engineer-targeted reference: license text, package status, runtime enforcement, and how to verify everything yourself.

## What's licensed how

Two RevealUI packages ship under **FSL-1.1-MIT** (Fair Source). Every other package in the suite is plain MIT.

| Package | License | Source | npm |
|---------|---------|--------|-----|
| `@revealui/ai` | FSL-1.1-MIT | [packages/ai](https://github.com/RevealUIStudio/revealui/tree/main/packages/ai) | [npm](https://www.npmjs.com/package/@revealui/ai) |
| `@revealui/harnesses` | FSL-1.1-MIT | [packages/harnesses](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses) | [npm](https://www.npmjs.com/package/@revealui/harnesses) |
| Everything else (`@revealui/core`, `@revealui/auth`, `@revealui/db`, `@revealui/contracts`, `@revealui/presentation`, `@revealui/router`, `@revealui/security`, `@revealui/utils`, `@revealui/cache`, `@revealui/resilience`, `@revealui/sync`, `@revealui/cli`, `@revealui/setup`, `@revealui/dev`, `@revealui/test`, `@revealui/editors`, `@revealui/mcp`, `@revealui/services`, `@revealui/openapi`, `@revealui/config`, `create-revealui`) | MIT | [packages/](https://github.com/RevealUIStudio/revealui/tree/main/packages) | [npm registry](https://www.npmjs.com/org/revealui) |

To verify any package's license:

```bash
npm view @revealui/ai license
# → "FSL-1.1-MIT"

npm view @revealui/core license
# → "MIT"
```

The `license` field in each package's `package.json` is the canonical record. Do not rely on this document if the npm registry says otherwise.

## What FSL-1.1-MIT lets you do

In plain English:

- ✅ **Use it commercially.** Ship it in your product, charge customers, no royalties or per-seat fees.
- ✅ **Read and modify the source.** Every line is on GitHub. Audit it for security, fork it, patch it.
- ✅ **Self-host on your own infra.** No phone-home, no vendor service required to function.
- ❌ **Build a competing developer platform.** You cannot ship a substantially similar developer platform that competes with RevealUI on top of these specific packages.

The non-compete clause is the only restriction. After **two years** (per release), even that lifts and the release becomes plain MIT.

The FSL spec is short and plain — read it: [fsl.software/FSL-1.1-MIT.template.md](https://fsl.software/FSL-1.1-MIT.template.md).

## How the 2-year MIT clock works

Each release starts its own clock at publish time. Older releases reach MIT first; newer releases extend the clock from their own publish dates.

```
@revealui/ai 0.4.0 published 2026-04-25
  → becomes MIT 2028-04-25

@revealui/ai 0.5.0 published 2026-08-01 (hypothetical)
  → becomes MIT 2028-08-01

@revealui/ai 0.6.0 published 2027-01-15 (hypothetical)
  → becomes MIT 2029-01-15
```

The conversion is in the license text and self-executing — RevealUI Studio does not need to take any action. Two years after publish, that release IS plain MIT, full stop.

## Pro tier enforcement (runtime, not source)

Source visibility ≠ free runtime access. The Pro tier is enforced at runtime via:

- **License JWTs** — RS256-signed by the license server (`apps/api/src/routes/license/`). Validated on every Pro entry point.
- **Per-package feature gates** — each Pro feature checks `isFeatureEnabled('ai' | 'mcp' | 'aiMemory' | ...)` from `@revealui/core/features` before executing.
- **Status checks every 5 minutes** — `checkLicenseStatus()` re-validates against the license server. Stale licenses are revoked at runtime.

This is documented at [apps/api/src/routes/license/](https://github.com/RevealUIStudio/revealui/tree/main/apps/api/src/routes/license).

The legal protection (FSL non-compete) and the runtime enforcement (license JWTs) are independent layers. Even with the source, building a competing platform on top is the case the license addresses, with civil remedies. Cracking the runtime check is technically possible (the source is there) but commercializing the result lands you in scope of the non-compete.

## Why not plain MIT for the Pro packages

Plain MIT lets a competitor fork on day one and undercut the project on price, leaving the studio with no path to sustain the work. FSL closes that specific risk while keeping every other freedom you actually need (commercial use, modification, self-host).

It's a deliberate middle path between "everything free, no business model" and "closed proprietary." The same approach used by Sentry, GitButler, and Keygen on their core platforms.

## Common engineer questions

### Can I deploy `@revealui/ai` to my own production for my own customers?

Yes. Charge them. No royalties. No usage caps from the license itself (the license server has its own usage limits per Pro tier, which are separate from the legal license).

### Can I fork `@revealui/ai` to fix a bug or add a feature?

Yes. Fork it, patch it, deploy your fork in your own production. The source is yours to modify.

### Can I publish my fork to npm as `@my-org/revealui-ai-improved`?

Generally yes — you're modifying source under a license that permits modification. The non-compete clause kicks in if your fork is positioned as a developer platform competing with RevealUI Studio's offering. If your fork is for your own internal use or for a non-competing product, you're fine.

### What if I'm building a competing developer platform without using these packages?

You can build whatever you want without using FSL packages. The license only restricts how you use the FSL-licensed code, not what you can build in general.

### Where do I send a license question?

[founder@revealui.com](mailto:founder@revealui.com?subject=Fair%20Source%20question). We'd rather answer ten "is this OK?" emails than have one company avoid shipping because they couldn't get a quick yes.

## See also

- Public-facing explainer with examples: [revealui.com/fair-source](https://revealui.com/fair-source)
- FSL-1.1-MIT canonical text: [fsl.software/FSL-1.1-MIT.template.md](https://fsl.software/FSL-1.1-MIT.template.md)
- FOSSA's announcement of the Functional Source License: [Sentry's blog post](https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/)
- Pro tier features and pricing: [revealui.com/pricing](https://revealui.com/pricing)
