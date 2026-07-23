# Marketing CMS page-blocks (conflict-proof)

## Why this layout exists

Concurrent VES page wires used to all edit one mega-file
(`page-blocks.ts`), plus a hand-maintained `PAGE_SEEDS` array in
`seed-fleet-marketing-site.ts`. Landing order then produced cascading
merge conflicts (fair-source → services → how-it-works → managed).

That does not scale for autonomous agents. Each page owns its module.

## Add a new CMS-wired page

1. Create `pages/<slug>.ts` with:
   - block derivation + slots
   - `export const <name>PageSeed: FleetMarketingPageSeed = { slug, path, title, blocks, seo }`
2. Add one line to `index.ts`: `export * from './pages/<slug>';`
3. Wire the route component to import slots from `../lib/page-blocks` (barrel) or `../lib/page-blocks/pages/<slug>`.
4. Do **not** edit a mono `PAGE_SEEDS` array. Seed auto-loads via `../../../../../scripts/lib/load-fleet-marketing-page-seeds.ts (server)`.

Gate: `pnpm validate:page-blocks-modules` (hard-fail in phase-1 CI).

## Layout

| Path | Role |
|------|------|
| `shared.ts` | helpers, `BlockSlot`, `blocksMatchFallback`, seed type |
| `pages/*.ts` | one file per CMS page (no cross-page edits) |
| `../../../../../scripts/lib/load-fleet-marketing-page-seeds.ts (server)` | auto-discover `*PageSeed` exports for fleet-marketing seed |
| `index.ts` | barrel re-exports |
| `../page-blocks.ts` | pure re-export shell for existing import paths |
