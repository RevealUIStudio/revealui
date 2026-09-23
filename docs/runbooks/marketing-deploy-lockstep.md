---
title: "Marketing deploy lockstep"
description: "Test-branch marketing copy stays undescribed as what customers see until production Deploy on main is green."
visibility: internal
status: verified
audience: maintainer
---

# Marketing deploy lockstep (GAP-466)

Marketing copy can land on `test` before customers see it. Production updates only when an owner promotes `test` to `main` and the Deploy workflow finishes green.

`pnpm validate:marketing-deploy-lockstep` is the guard:

- `customerVisible` in `scripts/validate/marketing-deploy-lockstep.json` stays false while the honesty surfaces differ from the last successful production Deploy on `main`.
- Prose that says test honesty is already what customers see fails the guard.
- A bot must not promote `test` to `main`. The owner promotes when live should match test honesty. This check never opens that promotion.

Offer lock still on test, not on main (verified 2026-09-23):

- RevealUI [pull 2925](https://github.com/RevealUIStudio/revealui/pull/2925) — Consultation $300, Proof Sprint $3,997, Launch $14,500
- Agency [pull 211](https://github.com/RevealUIStudio/agency/pull/211) — the same ladder on the studio site

Do not describe that ladder as customer-visible until main deploy is green.
