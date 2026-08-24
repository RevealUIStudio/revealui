---
visibility: public
status: verified
title: "Admin development"
description: "Expected HMR behavior when editing the RevealUI admin app, collections, and rich-text plugins"
category: guide
audience: developer
---

How to run the admin app in this monorepo and what hot reload actually does today. This is an operator/dev note, not a Next.js upgrade guide.

---

## Start the admin

From the repo root:

```bash
pnpm dev:admin   # admin only, port 4000
pnpm dev:app     # admin + API (3004)
```

`apps/admin` is Next.js 16 with Turbopack. `apps/admin/next.config.mjs` sets `turbopack.root` to the monorepo root so workspace packages resolve. Dev script: `next dev --port 4000`.

There is no published millisecond baseline for HMR in this repo. If you file a performance bug, include the file you edited, whether the browser refreshed, and a wall-clock measurement from save to UI change.

---

## What should hot-reload

| Edit | Expected today | If it does not |
|------|----------------|----------------|
| A page or component under `apps/admin/src/` | Fast Refresh / HMR | Restart `pnpm dev:admin` and file an issue with the path |
| A collection definition under `apps/admin/src/collections/` or `apps/admin/src/lib/collections/` | Should appear without a full restart | Restart. Collection HMR is not separately instrumented |
| A field component in `@revealui/core` consumed by admin | Depends on Turbopack picking up the workspace package | Restart admin |
| `@revealui/contracts` schema change | Often needs a restart. Types and Zod schemas are build-time | Restart admin (and regenerate types if your app does that) |
| Lexical plugin under `packages/core/src/client/richtext/plugins/` | Should HMR inside the editor. Editor state may reset | Restart. Losing editor state on plugin HMR is a known class of bug — report it |

These are expectations, not a measured SLA. [#535](https://github.com/RevealUIStudio/revealui/issues/535) Section B still tracks measurement and tighter collection/schema HMR.

---

## Known limitations

- Changing environment variables requires a restart. They are not hot-reloaded.
- Database schema changes are not HMR. Run `pnpm db:migrate`, then restart.
- `output: 'standalone'` is set for production packaging. It does not change the dev server.
- Full-stack live reload (admin + API + migrations in one watcher) is not a product. Run `pnpm dev:app` and restart the process that owns the file you changed.

---

## Filing an HMR bug

Include:

1. File path and the edit you made
2. `pnpm dev:admin` vs `pnpm dev:app`
3. Whether the browser refreshed, showed a stale UI, or errored
4. Next.js overlay text or terminal lines (no secrets)
5. Node and pnpm versions

Do not paste `.env` contents.

---

## Related

- [Quick Start](../QUICK_START.md)
- [Plugins](../PLUGINS.md)
- [Errors and debugging](./errors-and-debugging.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
