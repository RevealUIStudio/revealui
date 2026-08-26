# Overlay family anatomy (Phase 3 PR-4)

Dropdown (menu), Listbox, Combobox, plus modal overlays (Dialog, Drawer,
Alert). Grounded in product usage (admin pickers, docs showcase), WAI-ARIA APG
Menu / Listbox / Combobox / Dialog, and `@revealui/tokens`. Catalyst source
was not open while writing this. Existing package tests define behavioral
compatibility.

## Shared contract

| Concern | Rule |
|---|---|
| Focus ring | `focus.ts` only. Same `--ring` token as Button. |
| Active option | `activeOption` (`bg-primary` / `text-primary-foreground`). Never a palette step. |
| Keyboard | APG maps below. `useRovingTabindex` / `usePopover` / `useEscapeKey` stay the behavior layer. |
| Motion | Overlay enter/leave already honour reduced motion in `useTransition`. |

`data-focus` on options is our roving-tabindex marker (set by the hook), not a
vendor attribute. Class recipes for that marker live in `focus.ts`.

## Dropdown (APG Menu)

| Part | Role |
|---|---|
| Trigger | `DropdownButton` → real `<button>` (`aria-haspopup="menu"`, `aria-expanded`) |
| Menu | `role="menu"` portaled popover |
| Item | `role="menuitem"` (button or link) |

Keyboard: Enter / Space / ArrowDown open. ArrowUp/Down move. Escape closes and
returns focus to the trigger. Type-ahead is `useTypeAhead`.

Trigger ring: `focusRingData` (the trigger also carries `useDataInteractive`).
Item highlight: `activeOption` + `activeOptionForced`.

## Listbox (APG Select-Only Combobox)

| Part | Role |
|---|---|
| Trigger | real `<button role="combobox">` |
| Popup | `role="listbox"` |
| Option | `role="option"` (`aria-selected`) |

Keyboard: Enter / Space / ArrowDown open. Arrows move `aria-activedescendant`
equivalent via `data-focus`. Escape closes.

Trigger ring: native `:focus-visible` via `focusRingAfterVisible`. The trigger
is a real button; a `data-focus:` ring that nothing sets is a dead recipe.
Option highlight: `activeOption` + `activeOptionForced`.

## Combobox (APG Editable Combobox)

| Part | Role |
|---|---|
| Input | `<input role="combobox" aria-autocomplete="list">` |
| Popup | `role="listbox"` |
| Option | `role="option"` |

Keyboard: typing filters. ArrowDown/Up move. Enter selects. Escape closes.

Trigger/input ring: `focusRingAfterWithin` (`:focus-within` on the control
shell). Option highlight: same as Listbox.

## Modal overlays (APG Dialog)

| Part | Token |
|---|---|
| Backdrop | `bg-scrim` (`--rvui-scrim`). Never a hardcoded oklch overlay. |
| Panel | `bg-card` + `ring-border` / `ring-border-strong` + `shadow-lg`. |
| Title | `text-foreground`. |

Dialog, Drawer, and Alert already share `useFocusTrap` / `useScrollLock` /
`useEscapeKey` / `useTransition`. Drawer and Alert were already on the scrim
token. Dialog follows the same recipes so a light `[data-theme]` does not keep
a dark-only fallback.

Tooltip and Toast stay on their existing token surfaces (`bg-card`, status
fills). They do not use a page scrim.

## Do-not-redo

Layout grid (icon / label / shortcut columns) stays. The picker pass authors
the focus and active-option recipes. The modal pass authors the scrim /
surface tokens. Neither redesigns the menus or the dialog chrome.
