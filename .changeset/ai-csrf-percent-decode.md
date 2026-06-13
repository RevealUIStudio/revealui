---
'@revealui/ai': patch
---

`useAgentStream` now decodes the `revealui-csrf` cookie value before forwarding it as the `X-CSRF-Token` header. Next.js encodes cookie values with `encodeURIComponent` (via the `cookie` package), storing and returning the nonce:hmac string as `nonce%3Ahmac`; the admin proxy's `validateCsrfToken` calls `indexOf(':')` which finds nothing in the encoded form and returns false — the hook's POST requests were rejected with a 403 "CSRF token invalid" even when a valid session and correct token were present. The fix applies `decodeURIComponent` with a `try/catch` fallback to the raw value on `URIError`, matching the fix applied to all other CSRF readers in the same release cycle (#1405). No API change: callers without the cookie continue to send requests byte-identical to before.
