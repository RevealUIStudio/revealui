---
'@revealui/contracts': minor
'@revealui/presentation': minor
---

Add marketing-shaped section blocks to the canonical block union and a shared, annotatable block renderer.

**@revealui/contracts** — three new section-level block types on the canonical `BlockSchema` union (`pages.blocks`), each with a `create*Block` factory:

- `hero` — `{ eyebrow?, title, subtitle?, support?, links? }`
- `ctaSection` — `{ heading, body?, links?, snippet? }` (snippet is display-only CLI text)
- `section` — `{ eyebrow?, heading, body?, items? }`, the generic repeater covering FAQ / demo-beats / cards

Text fields are plain strings in P1 (no Lexical serialized state). A shared `MarketingLinkSchema` (`{ label, href, variant? }`) backs the hero and cta link arrays.

**@revealui/presentation** — a new `RenderBlocks` renderer (server-safe, render-only) that validates each block against `BlockSchema` and dispatches to per-type components (`HeroBlock`, `CtaSectionBlock`, `SectionBlock`, plus thin renderers for `text`/`heading`/`quote`/`list`/`divider`/`spacer`). Unsupported or invalid blocks render nothing with a dev-only diagnostic.

Edit-mode annotation contract: when `editable` and a `docId` are provided, every text-bearing element carries `data-rvui-doc` and `data-rvui-field` (a dot-path into the block array, e.g. `blocks.3.title`, `blocks.3.items.2.body`). No data attributes are emitted otherwise.
