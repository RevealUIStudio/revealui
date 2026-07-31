---
"@revealui/router": patch
---

Fix SSR hydrate so loader data is available via getCurrentMatch/useData on first client paint. Add Router.seedCurrentMatch and lock 0.3.x contract that client navigate does not run loaders or middleware.
