# CRM API contract — design draft

All routes are under `/api/crm` and require a server-verified authenticated user and account membership. The account ID is resolved from authorized context, never trusted solely from request JSON. Errors: 400 invalid input; 401 unauthenticated; 403 unauthorized; 404 not found or inaccessible; 409 conflict; 429 throttled.

| Resource | Operations | Notes |
|---|---|---|
| /organizations | GET POST | Search, pagination, provenance and duplicate checks |
| /organizations/:id | GET PATCH DELETE | Soft delete / retention review |
| /contacts | GET POST | Suppression-first; never auto-provision login |
| /contacts/:id | GET PATCH DELETE | Audit and contact-channel restrictions |
| /opportunities | GET POST | Stage, owner, forecast and next action |
| /opportunities/:id | GET PATCH | Optimistic concurrency; stage history |
| /opportunities/:id/activities | GET POST | Append-only activity timeline |
| /tasks | GET POST PATCH | Native ticket adapter with account boundary |
| /campaigns | GET POST PATCH | Draft, review, approved, paused, archived |
| /campaigns/:id/drafts | GET POST | Local AI suggestions or manually authored |
| /campaigns/:id/approve | POST | Human identity + immutable approval event |
| /campaigns/:id/send | POST | Must check approvals, suppression and provider configuration |
| /imports/preview | POST | Parse, validate, dedupe, show proposed changes |
| /imports/commit | POST | Idempotency key required |
| /dashboard | GET | Aggregates filtered to account |

Pagination is bounded. All writes validate Zod contracts and emit audit events. No endpoints are implemented by this document.
