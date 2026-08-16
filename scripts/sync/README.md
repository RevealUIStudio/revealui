# Sync manifests

Operator sync inventories (vault path maps and Vercel project IDs) live in
the private coordination repo at `ops/sync/`. This public tree ships only
the generic env-var contract (`secret-paths.ts`) and a resolver.

Set `REVEALUI_SYNC_MANIFEST_DIR` or `JV_REPO`, or keep the coordination
repo as a sibling of this checkout. Wrappers:

```bash
pnpm vercel:sync
pnpm vercel:drift-check
```

Do not copy the private TOML files back into this directory.
