---
'@revealui/core': minor
---

Expose five previously internal-but-documented modules as public subpath imports:

- `@revealui/core/api/compression` — response compression middleware + presets
- `@revealui/core/api/payload-optimization` — cursor pagination, field selection, response shaping
- `@revealui/core/api/rate-limit` — sliding-window rate limiter + presets (per-IP, per-user, per-API-key)
- `@revealui/core/api/response-cache` — HTTP cache middleware, ETag, tag-based invalidation
- `@revealui/core/monitoring/query-monitor` — `monitorQuery` DB performance wrapper

Each module has existed in source (`packages/core/src/api/*.ts`, `monitoring/query-monitor.ts`) with full unit test coverage but was not listed in `package.json#exports`, so `docs/PERFORMANCE.md` examples like `import { compressResponse } from '@revealui/core/api/compression'` would fail at the module resolver. No code changes — this is purely an exports-map addition.

Drops `docs-import-drift` findings by 35 (225 → 190).
