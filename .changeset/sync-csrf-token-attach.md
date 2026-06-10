---
"@revealui/sync": patch
---

Attach the `revealui-csrf` double-submit token as an `X-CSRF-Token` header on unsafe-method sync requests — `useSyncMutations` create/update/remove and the `useSharedMemories` reconciliation trigger. The admin proxy rejects cookie-authenticated POST/PATCH/DELETE to `/api/sync/*` without this header, so browser mutations (deleting a conversation or an agent memory in the admin dashboard) failed with 403 "CSRF token missing" once the admin CSRF gate landed. The token is read from the JS-readable cookie in browser contexts only and attached only to same-origin targets, mirroring the admin `apiFetch` / core `APIClient` pattern.
