---
"@revealui/presentation": minor
---

Brand-tokenize `Tab` and `Callout`, and make `Callout` usable as an inline status banner.

- `Tab`/`TabList`: replace the hardcoded `blue-*`/`zinc-*` palette with semantic tokens (`border-primary`/`text-primary` active, `text-muted-foreground`/`border-border` rest, `outline-ring` focus), and move the consumer `className` to last in the merge so the active color can be overridden.
- `Callout`: replace the per-variant raw palette (`blue/amber/red/green/violet`) with brand tokens (`primary`/`warning`/`error`/`success`/`accent`); title→`text-foreground`, body→`text-muted-foreground`. Add a `role` prop (`'note' | 'status' | 'alert'`, default `'note'`) so it can serve as an inline status/alert banner — the modal `Alert` remains modal-only.
