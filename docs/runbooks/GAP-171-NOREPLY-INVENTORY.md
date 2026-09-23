---
title: "GAP-171 — noreply@revealui.com inventory"
description: "Inventory of every hardcoded noreply@revealui.com occurrence. No from-address change. Owner creates the mailbox or names the replacement."
visibility: internal
status: verified
audience: maintainer
---

# GAP-171 — noreply@revealui.com inventory

**Status:** inventory only (2026-09-23). No from-address was changed. No mailbox was created.

This runbook lists every literal `noreply@revealui.com` in the monorepo at the time of the scan, with the surrounding line, and the owner steps that unblock a follow-up wire-up.

## OWNER

- Create `noreply@revealui.com` mailbox OR name the replacement from-address.
- Bot must not invent a from-address or create a Google Workspace user.
- After you decide, a follow-up can wire the chosen address. Until then, leave the literals below in place.

## Scan

Literal search for `noreply@revealui.com` across the working tree (2026-09-23, branch based on `test`).

| | |
|---|---|
| Occurrences | **12** |
| Files | **11** |
| Runtime fallbacks (send path when `EMAIL_FROM` is unset) | **3** |
| Compose / template defaults | **2** |
| Commented examples | **2** |
| Docs and code comments | **3** |
| Tests | **2** |

Nothing in this inventory is a behavior change. The strings below are the current code, config, docs, and tests.

## Runtime fallbacks

These three are the send path. When `EMAIL_FROM` is unset, Gmail domain-wide delegation and the MIME `From` header use `noreply@revealui.com`.

### 1. `packages/services/src/email/index.ts:125`

`GmailProvider` stores the delegate address and later writes it as the MIME `From` header (`index.ts` around the `From: ${this.delegateEmail}` line).

```
this.delegateEmail = process.env.EMAIL_FROM ?? 'noreply@revealui.com';
```

Comment on the same file, line 11, documents the env var with this address as the example. Counted under docs and comments below.

### 2. `packages/services/src/email/gmail-wif.ts:94`

Workload-identity JWT `sub` (the Workspace user the service account impersonates to send):

```
sub: env.EMAIL_FROM ?? 'noreply@revealui.com',
```

### 3. `packages/mcp/src/servers/_email-provider.ts:41`

MCP email provider delegate. `sendViaGmail` overwrites the payload `from` with this delegate before the Gmail API call.

```
const delegateEmail = overrides.EMAIL_FROM ?? process.env.EMAIL_FROM ?? 'noreply@revealui.com';
```

## Compose and template defaults

### 4. `docker-compose.forge.yml:127`

Forge compose default when `EMAIL_FROM` is unset in the environment:

```
EMAIL_FROM: ${EMAIL_FROM:-noreply@revealui.com}
```

### 5. `apps/admin/.env.production.template:57`

Uncommented production template value (not a live secret; it is the checked-in template):

```
EMAIL_FROM=noreply@revealui.com
```

## Commented examples

These lines are comments. They do not set the process environment by themselves.

### 6. `apps/admin/.env.example:122`

```
# EMAIL_FROM=noreply@revealui.com
```

### 7. `apps/server/.env.example:108`

```
# EMAIL_FROM=noreply@revealui.com
```

## Docs and code comments

### 8. `docs/ENVIRONMENT-VARIABLES-GUIDE.md:180`

Documented default for `EMAIL_FROM`:

```
| `EMAIL_FROM` | No | `noreply@revealui.com` | Sender address for transactional emails. Must match a domain the Gmail service account can send as. | LOW | admin, api |
```

### 9. `packages/mcp/src/servers/revealui-email.ts:16`

File header comment:

```
*   EMAIL_FROM                    -  Sender address (default: noreply@revealui.com)
```

### 10. `packages/services/src/email/index.ts:11`

File header comment:

```
*   EMAIL_FROM                    -  sender address (e.g. noreply@revealui.com)
```

## Tests

### 11. `packages/services/src/email/__tests__/email-service.test.ts:71`

Test setup stubs the env var to the same address the runtime fallback uses:

```
vi.stubEnv('EMAIL_FROM', 'noreply@revealui.com');
```

### 12. `packages/mcp/src/__tests__/revealui-email-validation.test.ts:40`

Fixture `from` on an `email_send` args object that the schema accepts:

```
from: 'noreply@revealui.com',
```

## Adjacent address (not this literal)

`packages/mcp/src/servers/revealui-email.ts:86` sets a different constant:

```
const DEFAULT_FROM = 'RevealUI <notifications@revealui.com>';
```

That constant is the MCP tool `from` fallback when `EMAIL_FROM` and `REVEALUI_FROM_EMAIL` are both unset (`revealui-email.ts` around lines 160-165). The Gmail send path in `_email-provider.ts` then replaces `From` with the delegate, which falls back to `noreply@revealui.com`. This inventory does not treat `notifications@revealui.com` as a `noreply@revealui.com` hit, and it does not propose either address as the replacement.

Root `.env.template` and `.env.production.example` use `noreply@yourdomain.com`. Those are placeholders, not this literal.

## Follow-up (after the owner decides)

Do not start this until the owner has created the mailbox or named the replacement. A later change would touch the three runtime fallbacks, the compose default, the production template, the commented examples, the env guide, the two comments, and the two tests together so the documented default and the code default stay the same string. This PR does not do that.
