# Data family anatomy (Phase 3 PR-6)

Table, DescriptionList, Pagination. Grounded in admin lists + docs showcase,
WAI-ARIA APG Table / Description List / Navigation, and `@revealui/tokens`.
Catalyst source was not open. Existing tests define behavioral compatibility.

## Shared contract

| Concern | Rule |
|---|---|
| Focus ring | Shared `focus.ts` recipes. Row-as-link uses `focusRingHasVisible` (`:focus-visible` on the stretched child). Pagination uses `Button` (`focusRing`). |
| Tokens | `text-foreground`, `text-muted-foreground`, `border-border`, `bg-foreground/2.5`. No palette steps. |
| Density | Table `dense` / `striped` / `grid` / `bleed` stay as layout flags. |

## Table (APG Table)

Compound `Table` / `TableHead` / `TableBody` / `TableRow` / `TableHeader` /
`TableCell`. A row with `href` stretches an overlay `Link` across each cell.
The link hides its native outline; the `<tr>` paints `focusRingHasVisible`.
Only the first cell's link is in tab order (`tabIndex={0}`); later cells are
`-1`.

## DescriptionList

`dl` / `dt` / `dd`. Two-column from `sm`. First term has no top rule
(`first:border-none` and `sm:first:border-none`) so the list does not grow
a stray cap border at the small breakpoint.

## Pagination

Nav landmark. Page controls are `Button` (`variant="neutral"`). Focus is
already the shared button ring.

## Do-not-redo

Layout flags and the overlay-link row pattern stay. This pass authors the
row ring onto the shared token recipe and closes the truncated `sm:` class
on `DescriptionTerm`.
