---
visibility: public
status: verified
title: "Service level commitments"
description: "Published RevealUI Studio support and uptime commitments."
category: legal
audience: user
---

This page describes paid support and the license infrastructure uptime target.

Support policy revision: **2026-10-04**, maintained in `PAID_SUPPORT_POLICY` in `packages/contracts/src/public-catalog.ts`. The existing infrastructure uptime and maintenance-notice commitments remain in effect.

RevealUI Studio is a solo-operated company with no backup support staff or on-call rotation. The support targets below are the same for every paid tier.

This support policy (revision 2026-10-04) applies to new purchases made after it is published. Agreements accepted before publication retain their stated support commitments; this policy does not reduce them.

---

## The short version

Email support has best-effort response targets of **24 hours for requests received on weekdays** and **4 hours for critical issues**. These are targets, not guaranteed response times or guaranteed coverage. License validation and download/release infrastructure target **99% monthly uptime**. Live status: [revealui.com/status](https://revealui.com/status).

---

## Support response times

- **Weekday target:** we aim to reply within 24 hours for requests received on weekdays. Support hours are Monday through Friday, 9am to 5pm U.S. Central Time, excluding U.S. federal holidays. Requests received outside those hours may take longer.
- **Critical issues:** best-effort response target within 4 hours, any day. A critical issue is one where your data is at risk or you cannot use the product you purchased at all.

These targets apply to email sent to support@revealui.com. There is no faster staffed tier or guaranteed staffed coverage. Earlier accepted agreements retain their stated response commitments.

---

## Infrastructure uptime

For the **license validation** endpoint and the **download and release** endpoint, we target 99% uptime, measured monthly. That is as much as 7.3 hours of downtime in a month before we would consider ourselves out of this commitment.

If you self-host RevealUI, this uptime commitment covers **our** infrastructure (license validation, downloads, and updates), not yours. Your Compose/Vercel/Fly deployment is your responsibility. See [Deployment](./guides/deployment.md).

A hosted RevealUI product beyond license and download infrastructure does **not** yet carry a published uptime commitment. When that changes, this page will say so first.

---

## Planned maintenance

When we need to take infrastructure down for planned maintenance, we give at least 48 hours of advance notice by email to affected customers and on the status page.

---

## License service down

The API middleware can retain previously verified status for the exact signed
license grant for up to seven days during an authority outage. This evidence is
currently held in process memory: a restart loses it, and a grant without prior
verification fails closed. Restart-safe continuity is not part of this published
commitment. The Terms describe continued use of acquired perpetual versions and
the limits of support coverage.

---

## What this is not

- Not a 99.9% / 99.99% promise.
- Not an Enterprise-only number. Paid tiers share the same response commitment.
- Not a credit schedule. Service credits are not published as a formula on this page.
- Not a claim about your self-hosted collab WebSocket, Neon project, or object store.

---

## Related

- [Status](https://revealui.com/status)
- [Deployment](./guides/deployment.md)
- [Enterprise](./ENTERPRISE.md)
- [Enterprise SSO status](./FORGE_SSO_SETUP.md) — operator preview; [#449](https://github.com/RevealUIStudio/revealui/issues/449)
