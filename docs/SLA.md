---
visibility: public
status: verified
title: "Service level commitments"
description: "Docs restatement of the published RevealUI Studio support and uptime commitments. Canonical public page is revealui.com/sla."
category: legal
audience: user
---

This page restates the commitments already published at [revealui.com/sla](https://revealui.com/sla). It does not invent a new number. If the two disagree, the marketing page plus `apps/marketing/app/content/legal/sla.ts` win until this file is updated.

Owner source for the numbers: the SLA target decision recorded as Option B (2026-04-16). Public copy last updated on that page: 12 July 2026.

RevealUI Studio is a solo-operated company. The commitments below are what we can hold on a bad week.

---

## The short version

We respond within 24 hours during U.S. business hours, and within 4 hours for anything critical. License validation and download/release infrastructure target **99% monthly uptime**. Live status: [revealui.com/status](https://revealui.com/status).

---

## Support response times

- **Business hours:** respond within 24 hours, Monday through Friday, 9am to 5pm U.S. Central Time, excluding weekends and U.S. federal holidays.
- **Critical issues:** respond within 4 hours, any day. A critical issue is one where your data is at risk or you cannot use the product you purchased at all.

These targets apply to email sent to support@revealui.com. They are the same for every paid tier today. There is no faster staffed tier and no Slack on-call rotation.

---

## Infrastructure uptime

For the **license validation** endpoint and the **download and release** endpoint, we target 99% uptime, measured monthly. That is as much as 7.3 hours of downtime in a month before we would consider ourselves out of this commitment.

If you self-host RevealUI, this uptime commitment covers **our** infrastructure (license validation, downloads, and updates), not yours. Your Compose/Vercel/Fly deployment is your responsibility. See [FLEET.md](./FLEET.md) and [Deployment](./guides/deployment.md).

A hosted RevealUI product beyond license and download infrastructure does **not** yet carry a published uptime commitment. When that changes, [revealui.com/sla](https://revealui.com/sla) will say so first.

---

## Planned maintenance

When we need to take infrastructure down for planned maintenance, we give at least 48 hours of advance notice by email to affected customers and on the status page.

---

## License service down

If a self-hosted installation cannot reach the license validation service, a previously validated license keeps working for 7 days while we fix the outage. Full legal detail is in the Terms of Service.

---

## What this is not

- Not a 99.9% / 99.99% promise.
- Not an Enterprise-only number. Paid tiers share the same response commitment.
- Not a credit schedule. Service credits are not published as a formula on this page.
- Not a claim about your self-hosted collab WebSocket, Neon project, or object store.

---

## Related

- [revealui.com/sla](https://revealui.com/sla)
- [revealui.com/status](https://revealui.com/status)
- [Fleet self-host](./FLEET.md)
- [Enterprise SSO status](./FORGE_SSO_SETUP.md) — operator preview; [#449](https://github.com/RevealUIStudio/revealui/issues/449)
