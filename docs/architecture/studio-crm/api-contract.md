---
title: "Studio CRM API"
description: "Implemented native admin CRM route contract and authorization boundary."
visibility: internal
status: draft
audience: maintainer
---

# Native admin CRM API

Routes live in the admin application under `/api/crm`. An authenticated non-recovery session, applicable MFA and active account membership are required. `X-Account-ID` selects a candidate account; the service reauthorizes it and never trusts body-supplied identity. Mutation requests require same-origin and existing signed CSRF protection. Strict Zod validation rejects unknown fields. All successful responses are private/no-store.

| Route | Method | Operation |
|---|---|---|
| `/organizations`, `/contacts`, `/opportunities`, `/activities`, `/tasks`, `/campaigns`, `/drafts`, `/suppression`, `/enrollments`, `/bookings`, `/imports`, `/audit` | GET | Account-scoped list with limit 1–100, offset 0–100000 |
| `/organizations`, `/contacts`, `/opportunities`, `/activities`, `/tasks`, `/campaigns`, `/drafts` | POST | Create validated native record |
| `/organizations/:id`, `/contacts/:id`, `/opportunities/:id`, `/tasks/:id`, `/campaigns/:id`, `/drafts/:id` | PATCH | Optimistic version required; draft edit clears approval |
| `/organizations/:id`, `/contacts/:id` | DELETE | Owner/admin tombstone; contact archive suppresses and cancels drafts |
| `/opportunities/:id/stage` | POST | Validated transition plus immutable history |
| `/opportunities/:id/revenue` | POST | Owner/admin evidenced reconciliation; never inferred from pipeline value |
| `/drafts/:id/approve` | POST | Owner/admin review identity, version and suppression/channel checks |
| `/drafts/generate` | POST | Opt-in native local-model draft; bounded inference and rate limit |
| `/suppression` | POST | Email normalization, suppression and draft cancellation |
| `/enrollments` | POST | Unique account/campaign/contact enrollment |
| `/bookings` | POST | Link an operator-owned canonical private consultation binding |
| `/bookings/:id/reconcile` | POST | Idempotently observe source lifecycle; no payment or stage mutation |
| `/imports/preview`, `/imports/commit` | POST | Organization intake; commit requires idempotency key |
| `/imports/contacts/preview`, `/imports/contacts/commit` | POST | External-contact intake; preserve suppression |
| `/dashboard` | GET | Stage/currency totals, overdue work, activity/draft counts and booking links |

Errors: 400 invalid input, 401 no session, 403 unauthorized, 404 unavailable/inaccessible resource, 409 stale edit/reference/deduplication/workflow conflict, 413 oversized mutation, 429 local AI rate limit, 503 unavailable runtime. Validation error responses do not echo private input. Input forms/contracts are in `@revealui/db/crm-contracts`.

Activities and audit records are append-only through this API. There is no send route. Draft approval does not send a message; response-rate actuals remain unavailable until an independently reviewed transport supplies authoritative delivery events. Pipeline value is separate from reconciled realized revenue, grouped by currency.
