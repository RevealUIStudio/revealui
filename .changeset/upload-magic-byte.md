---
"@revealui/contracts": minor
---

Add server-side upload validation helpers and drop `image/svg+xml` from the
media allowlist.

`verifyMagicBytes(mimeType, bytes)` checks a file's leading bytes against its
declared MIME type so a client cannot store active content (HTML/JS) under an
image type, or a polyglot — fail-closed on unknown/unverifiable types.
`extensionForMimeType(mime)` derives a safe storage extension from the verified
type (never the user-supplied filename), and `sanitizeFilename(name)` strips
path separators / control characters and clamps length. `image/svg+xml` is
removed from `IMAGE_MIME_TYPES` (text/markup with no signature + an
inline-script XSS vector; re-introduce only behind server-side sanitization).
