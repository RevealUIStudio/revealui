---
'@revealui/core': minor
'@revealui/db': minor
---

Expose two previously internal-but-documented modules as public subpath imports:

- `@revealui/core/cache/query-cache` — `cacheQuery`, `cacheList`, `cacheItem`, `invalidateCache`, `invalidateCachePattern`, `invalidateResource`, `cacheSWR`
- `@revealui/db/pool` — `getPool`, `pool`, `checkDatabaseHealth`, `getPoolStats`, `startPoolMonitoring`, `warmupPool`

Both modules have existed in source with full unit test coverage (`packages/core/src/cache/query-cache.ts`, `packages/db/src/pool.ts`) but were not listed in `package.json#exports`, so `docs/DATABASE.md` examples like `import { monitorQuery } from '@revealui/core/monitoring/query-monitor'` and `import { getPoolStats } from '@revealui/db/pool'` would fail at the module resolver. No code changes — purely exports-map additions.

`@revealui/core/monitoring/query-monitor` is exposed separately in the companion PR that adds `api/*` subpaths.
