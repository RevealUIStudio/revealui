---
'@revealui/presentation': minor
'@revealui/core': minor
---

**`@revealui/presentation`** — expose 4 Catalyst-style components from the main barrel:

- `Heading`, `Subheading` (from `./components/heading`)
- `Link` (from `./components/link`)
- `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `Code`, `Strong`, `Text`, `TextLink` (from `./components/text`)

All four source files already existed but were not re-exported from `src/components/index.ts`. The documented usage in `docs/COMPONENT_CATALOG.md` expected them at the top level.

To avoid naming collision, the CVA-style primitives previously exported as `Heading` and `Text` from `./primitives` are now aliased as `HeadingPrimitive` and `TextPrimitive`. They remain available under `./primitives` via their file paths unchanged; only the barrel re-export name changed. No internal or external consumers import the primitive-named variants from the main barrel.

**`@revealui/core`** — expose three `./client/*` subpath imports that already exist in the source tree:

- `@revealui/core/client/ui`
- `@revealui/core/client/admin`
- `@revealui/core/client/richtext`

Previously only the top-level `./client` barrel was exported; consumers could already reach these identifiers via that barrel, but the documented imports (`@revealui/core/client/ui`, etc.) failed at the resolver.

Drops `docs-import-drift` findings by 41 (225 -> 184). Brings `docs/COMPONENT_CATALOG.md` to zero drift.
