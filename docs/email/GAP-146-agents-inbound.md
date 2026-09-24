---
title: "GAP-146 — agents@ inbound stub"
description: "Flagged-off receiver stub for inbound mail at agents@revealui.com. Does not enable Email Routing, change DNS, or send mail."
visibility: internal
status: narrative
audience: maintainer
owner: RevealUI Studio
last_verified: 2026-09-23
---

# GAP-146 — agents@ inbound stub

This pull request is a flagged stub. It does not create a mailbox. It does not change Cloudflare nameservers or any DNS record. It does not turn on Email Routing.

## Owner gate before Email Routing

The owner must finish the Cloudflare nameserver move (GAP-133 phase 1) before enabling Email Routing. Until that move is done, leave `AGENTS_EMAIL_INBOUND` unset or any value other than the exact string `true`.

The zone sheet at [GAP-233 + GAP-133](../runbooks/GAP-233-133-cloudflare-dns.md) does not apply a nameserver change. The owner applies GAP-133 phase 1 separately. This document does not apply it.

## What the stub does

`apps/server/src/lib/agents-email-inbound.ts` reads a simple RFC822/MIME message. It yields an internal agent-inbound event `{ from, to, subject }` only when both of the following hold:

1. `AGENTS_EMAIL_INBOUND` is the exact string `true`. Unset, `false`, `1`, and every other value are off.
2. A parsed `To` address is `agents@revealui.com`.

Flag off is a documented rejection (`flag-off`). The receiver yields no event and does not enqueue. A different recipient is ignored (`wrong-recipient`): no event. The module does not send mail.

## Gmail unchanged

Gmail stays the human and transactional sender (`apps/server/src/lib/email.ts` and `@revealui/services/email`). This stub does not send outbound mail as `agents@revealui.com`.

## Not a customer recipe

There is no customer-facing email recipe and no admin UI for this path. Do not publish a visitor setup for Email Routing from this file.
