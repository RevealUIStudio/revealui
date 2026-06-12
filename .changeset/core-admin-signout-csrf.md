---
"@revealui/core": patch
---

The admin dashboard sign-out button now echoes the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues on page load) as an `X-CSRF-Token` header on its POST. The proxy requires that header on any session-cookie-bearing unsafe request, and sign-out always runs with a session, so the request was rejected with a 403 "CSRF token missing" while the swallowed failure still navigated to /login  -  the server-side session was never revoked and cookies were never cleared. The cookie is read immediately before the POST via a shared `readCsrfToken()` helper, extracted verbatim from the admin `APIClient` (which now uses it too, behavior unchanged). When the cookie is absent (non-browser callers, no admin session) the request stays byte-identical to before  -  no `headers` key is sent.
