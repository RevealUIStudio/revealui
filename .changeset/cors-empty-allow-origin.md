---
"@revealui/core": patch
---

Return an empty CORS allow-origin when the request origin is not on the configured allowlist. A missing or empty allowlist also grants no origin. Matching origins are unchanged.
