# Nav family anatomy (Phase 3 PR-5)

Sidebar, Navbar, Tabs. Grounded in admin shell + docs showcase, WAI-ARIA APG
Navigation / Tabs, and `@revealui/tokens`. Catalyst source was not open.
Existing tests define behavioral compatibility.

## Shared contract

| Concern | Rule |
|---|---|
| Focus ring | `focusRing` (`:focus-visible` + `--ring`). Real `<button>` / `<a>` hosts. |
| Current page | `data-current` + `LayoutIndicator` bar (sidebar left, navbar bottom). |
| Hover / press | `useDataInteractive` `data-hover` / `data-active` on buttons. Links go through `Link`. |
| Tokens | `text-foreground`, `bg-foreground/5`, `border-border`, `text-primary`. No palette steps. |

## Sidebar (APG Navigation)

`Sidebar` is a `<nav>`. Items are links or buttons. Current item shows a
vertical brand-ink bar. Keyboard: native tab order. Current indicator is
visual only; the link remains the accessible name.

## Navbar (APG Navigation / Toolbar)

`Navbar` is a `<nav>`. Items share the same interaction contract as Sidebar.
Current item shows a horizontal bar under the control.

## Tabs (APG Tabs)

| Part | Role |
|---|---|
| List | `role="tablist"` |
| Tab | `role="tab"` (`aria-selected`, roving `tabIndex`) |
| Panel | `role="tabpanel"` |

Keyboard: ArrowLeft/Right, Home, End. Active tab uses `border-primary`
/`text-primary`. Focus ring is `focusRing`.

## Do-not-redo

Layout (section/header/footer, spacers, indicators) stays. This pass authors
the focus recipe onto the shared token ring.
