---
"@revealui/presentation": minor
---

**Design system: bump canonical button/link vertical sizing.**

`<Button>` (CVA) and `<LinkButton>` in `@revealui/presentation` are the design-system primitives every fleet surface consumes — marketing, docs, admin, RevDev, RevealCoin all import from here. Updating `buttonVariants.size` is therefore a design-system contract change, not a per-surface patch.

The previous size table relied on fixed `h-*` values with no explicit vertical padding. With `text-sm` (14px) centered in `h-11` (44px), the rounded edge (`var(--rvui-radius-md, 10px)`) sat only ~12px from the text — the button read as a cramped pill rather than a deliberate rounded rectangle.

New size contract:

| Size | Before | After | Height (px) |
|------|--------|-------|-------------|
| `default` | `h-10 px-4 py-2` | `h-11 px-4 py-2.5` | 40 → 44 |
| `lg` | `h-11 rounded px-8` | `h-12 rounded px-8 py-3` | 44 → 48 |
| `sm` | `h-9 rounded px-3` | `h-10 rounded px-3 py-2` | 36 → 40 |
| `icon` | `size-10` | `size-11` | 40 → 44 (square) |

`icon` is bumped to stay square + inline-aligned with the new `default` height. Explicit `py-*` is belt-and-suspenders so spacing survives if a consumer uses `size="clear"` plus a custom height.

**Scope notes:**
- `LinkButton` consumes the same `buttonVariants` — no separate edit needed.
- `button-headless.tsx` (Catalyst-style fork used in admin/RevDev) is intentionally NOT updated. The headless-vs-styled duality is a tracked design-system gap (deferred per the 2026-05-16 revenue-only posture). The CVA `<Button>` is the canonical surface this changeset speaks for.

Minor (not patch) because the visual contract cascades uniformly to every consumer — Hero CTAs, admin form actions, doc-site nav, RevDev launcher buttons all become 4px taller in the same release.
