---
visibility: public
status: narrative
title: "Build Your First Business with RevealUI"
description: "Choose a starting point, configure your deployment, and evaluate a business workflow"
category: tutorial
audience: developer
lastUpdated: "2026-09-30"
---

# Build your first business with RevealUI

Start with one workflow your team needs. RevealUI supplies a self-hosted foundation for People, Content, Offers, Payments, and Agents; a scaffold still needs configuration and application work. This guide connects the maintained setup and feature guides. It does not promise a deployment time or a complete production stack from a starter command.

## Choose a starting point

Use the [templates page](https://revealui.com/templates) to compare the starter, blog, portfolio, and e-commerce starting points and their prerequisites. For the CLI scaffold:

```bash
npx create-revealui@latest my-business
```

Follow the generated project's README and package scripts. Its layout is a starter application; it does not contain the full RevealUI monorepo's `apps/admin` and `apps/server` directories. For work on the full runtime, follow the [quick start](./QUICK_START.md) and [admin development guide](./guides/admin-dev.md) from the public repository.

You need to be able to operate the selected infrastructure. Hosting, database services, storage, payments, and model usage have their own setup and costs. Review the [deployment guide](./guides/deployment.md) and [environment variables guide](./ENVIRONMENT-VARIABLES-GUIDE.md) for the setup you choose. Keep credentials out of source control.

## Define and inspect one workflow

Use the [collections guide](./guides/collections.md) to define the data and access rules your workflow needs. Test who may read, create, update, and delete records. Create sample records through the supported admin or API path; do not assume an arbitrary collection has a matching database schema or a seed command.

For identity and access, follow the [authentication guide](./guides/authentication.md). For checkout, subscriptions, and webhook setup, follow the [billing guide](./guides/billing.md). Test the intended checkout and entitlement transition in test mode before accepting payment; a return URL alone is not payment confirmation.

Agent orchestration requires the appropriate paid entitlement, configured tools, and model access. The [local-first guide](./LOCAL_FIRST.md) describes a supported local inference path and its service dependencies. Configure the provider explicitly and evaluate a representative task. The [audit receipt guide](./security/AUDIT_RECEIPTS.md) explains signing, tier boundaries, anchoring, and offline verification.

## Decide whether to proceed

Check the workflow as a user: can the right person sign in, complete the intended action, inspect the resulting data and supported records, and recover from a useful error? Confirm who will maintain it, what services it relies on, and what the software license permits.

Compare licenses on [pricing](https://revealui.com/pricing). The core is MIT; Pro packages are source available under FSL-1.1-MIT. If you need help reviewing or implementing a bounded workflow, [RevealUI Studio](https://revealuistudio.com) offers Consultation, Pilot, and Launch. Agree on scope and ongoing responsibilities before work starts.

This replaces the earlier unverified “45 minutes” tutorial, which incorrectly combined a starter scaffold with full-monorepo paths and an unsupported seed script. A clean deployment timing claim should be published only after the maintained setup path has been reproduced and measured.
