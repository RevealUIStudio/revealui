---
visibility: public
status: verified
title: "Fair Source"
description: "How RevealUI Pro packages are licensed under FSL-1.1-MIT, what you can and cannot do with them, and how MIT conversion follows the published license."
category: reference
audience: developer
---

This document is the engineer-targeted Fair Source reference: license text, package status, runtime enforcement, and how to verify everything yourself.

## What's licensed how

Five RevealUI packages ship under **FSL-1.1-MIT** (Fair Source). Other package licenses vary; consult each package’s `package.json` and license file. The core is MIT.

| Package | License | Source | npm |
|---------|---------|--------|-----|
| `@revealui/ai` | FSL-1.1-MIT | [packages/ai](https://github.com/RevealUIStudio/revealui/tree/main/packages/ai) | [npm](https://www.npmjs.com/package/@revealui/ai) |
| `@revealui/engines` | FSL-1.1-MIT | [packages/engines](https://github.com/RevealUIStudio/revealui/tree/main/packages/engines) | _private — not published_ |
| `@revealui/harnesses` | FSL-1.1-MIT | [packages/harnesses](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses) | [npm](https://www.npmjs.com/package/@revealui/harnesses) |
| `@revealui/mcp` | FSL-1.1-MIT | [packages/mcp](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp) | [npm](https://www.npmjs.com/package/@revealui/mcp) |
| `@revealui/services` | FSL-1.1-MIT | [packages/services](https://github.com/RevealUIStudio/revealui/tree/main/packages/services) | [npm](https://www.npmjs.com/package/@revealui/services) |
| MIT packages (`@revealui/core`, `@revealui/auth`, `@revealui/db`, `@revealui/contracts`, `@revealui/presentation`, `@revealui/router`, `@revealui/security`, `@revealui/utils`, `@revealui/cache`, `@revealui/resilience`, `@revealui/sync`, `@revealui/cli`, `@revealui/setup`, `@revealui/dev`, `@revealui/test`, `@revealui/openapi`, `@revealui/config`, `@revealui/paywall`, `create-revealui`) | MIT | [packages/](https://github.com/RevealUIStudio/revealui/tree/main/packages) | [npm registry](https://www.npmjs.com/org/revealui) |

To verify any package's license:

```bash
npm view @revealui/ai license
# → "FSL-1.1-MIT"

npm view @revealui/core license
# → "MIT"
```

Read the LICENSE file shipped with the version you use. Registry metadata helps identify the declared license; it does not replace the license text.

## What FSL-1.1-MIT lets you do

In plain English:

- ✅ **Use it commercially.** Ship it in your product, charge customers, no royalties or per-seat fees.
- ✅ **Read and modify the source.** Every line is on GitHub. Audit it for security, fork it, patch it.
- ✅ **Self-host on your own infra.** Paid runtime features require valid entitlement. Review your deployment and service dependencies when planning operation.
- ❌ **Build a competing developer platform.** You cannot ship a substantially similar developer platform that competes with RevealUI on top of these specific packages.

Read the LICENSE file shipped with the package for its permitted purpose, restrictions, and conversion terms.

## MIT conversion

The package LICENSE specifies a Change Date. FSL conversion occurs on that date or the fourth anniversary of the first public distribution of the licensed work under FSL, whichever comes first. A version tag alone does not establish a new two-year clock. The current repository’s Pro license files specify April 8, 2028; inspect the file included in the version you use.

## Pro tier enforcement (runtime, not source)

Source visibility ≠ free runtime access. The Pro tier is enforced at runtime via:

- **License JWTs** — Ed25519-signed by the license server (`apps/server/src/routes/license/`). Validated on every Pro entry point.
- **Per-package feature gates** — each Pro feature checks `isFeatureEnabled('ai' | 'mcp' | 'aiMemory' | ...)` from `@revealui/core/features` before executing.
- **License validation** — the self-hosted runtime validates the configured signed key. Hosted license-status endpoints also check recorded entitlement status.

This is documented at [apps/server/src/routes/license/](https://github.com/RevealUIStudio/revealui/tree/main/apps/server/src/routes/license).

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

- Public-facing explainer with examples: this page
- FSL-1.1-MIT canonical text: [fsl.software/FSL-1.1-MIT.template.md](https://fsl.software/FSL-1.1-MIT.template.md)
- FOSSA's announcement of the Functional Source License: [Sentry's blog post](https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/)
- Pro tier features and pricing: [revealui.com/pricing](https://revealui.com/pricing)
