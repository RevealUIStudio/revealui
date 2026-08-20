---
visibility: public
status: verified
title: "Errors and debugging"
description: "API error envelope, where errors are persisted, and how to file an actionable bug"
category: guide
audience: developer
---

How RevealUI reports failures to clients and what to attach when you file a bug. Improving opaque `throw new Error(...)` sites is still tracked on [#535](https://github.com/RevealUIStudio/revealui/issues/535) Section C. This page documents the envelope that already ships.

---

## API error envelope

The Hono API (`apps/server`) uses one JSON shape (`apps/server/src/middleware/error.ts`):

```ts
{
  success: false
  error: string
  code: string
  details?: unknown
  requestId?: string
}
```

| `code` | When |
|--------|------|
| `HTTP_<status>` | `HTTPException` (4xx or 5xx) |
| `VALIDATION_ERROR` | Zod validation failure. `details` is included only when `NODE_ENV` is not `production` |
| `INTERNAL_ERROR` | Unhandled throw. Message is generic in the response |

5xx responses are persisted to `error_events` (fire-and-forget) and sent to Sentry when Sentry is configured. 4xx are not persisted.

The admin Next.js app has its own `/api/health` surface. Do not confuse it with the Hono `GET /health` / `GET /health/ready` routes.

---

## Structured logs

Production code uses `@revealui/utils` (re-exported through `@revealui/core` observability). In production, logs go to stdout as JSON. There is no first-class `DEBUG=revealui:*` namespace switch in this repo. Use log level configuration on the logger and your process manager.

Do not add `console.*` in packages. See the conventions skill / `docs/agent-rules/conventions.md`.

---

## Client and admin errors

- React error boundaries and fallback UI live in `packages/core/src/error-handling/`. Module README: `packages/core/src/error-handling/README.md`.
- Admin toasts should include the API `code` when the failure came from the API. If a toast has no code, copy the `requestId` from the network response.
- Config mistakes at boot throw `ConfigValidationError` from `@revealui/contracts` (`error.getMessages()`, `error.issues`).

---

## What to try first

| Symptom | Check |
|---------|--------|
| `ConfigValidationError: REVEALUI_SECRET` | Secret missing or shorter than 32 characters. See [Quick Start](../QUICK_START.md) and [RevVault](../fleet/revvault.md) |
| `relation "…" does not exist` | Run `pnpm db:migrate` |
| `HTTP_403` on a Fleet kit | Host header vs `REVFORGE_LICENSED_DOMAIN`. See [FLEET.md](../FLEET.md) |
| `INTERNAL_ERROR` | Look up `requestId` in API logs / `error_events` |
| Blank admin after deploy | `NEXT_PUBLIC_SERVER_URL` / `REVEALUI_PUBLIC_SERVER_URL` mismatch |

More cases: [Troubleshooting](../TROUBLESHOOTING.md).

---

## Filing an actionable bug

Use this shape:

1. **What failed** — the user-visible action (sign in, save a post, checkout)
2. **Why it failed** — `code`, HTTP status, `requestId`, and the log line if you have one
3. **What you tried** — migrate, restart, which env file, which URL
4. **Repro** — Node/pnpm versions, Free vs licensed, local vs Fleet

Do not attach secrets, session cookies, or license JWTs. Redact `POSTGRES_URL` and Stripe keys.

---

## Related

- [Troubleshooting](../TROUBLESHOOTING.md)
- [Admin development](./admin-dev.md)
- [Audit receipts](../security/AUDIT_RECEIPTS.md)
- [SLA](../SLA.md)
