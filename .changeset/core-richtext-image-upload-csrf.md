---
"@revealui/core": patch
---

The rich-text editor's image-upload button now echoes the JS-readable `revealui-csrf` cookie (the signed double-submit token the RevealUI admin proxy issues on page load) as an `X-CSRF-Token` header on its upload POST. The admin proxy requires that header on any session-cookie-bearing unsafe `/api/*` request and the editor's default `/api/media` endpoint is not CSRF-exempt, so editor image uploads from the admin app were rejected with a 403 "CSRF token missing" before reaching any route. The token is re-read immediately before each POST via the shared `readCsrfToken()` helper and attached by spreading a whole `headers` key only when a token is readable - callers without the cookie (non-browser, no admin session, cross-origin pages) keep a byte-identical request with no `headers` key, and `Content-Type` is never set so `fetch` continues to derive the multipart boundary from the `FormData` body.
