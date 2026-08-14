/**
 * focus.ts — the one focus-ring treatment.
 * ────────────────────────────────────────────────────────────────────────
 * Blocker 2 of `Assessment · Enterprise Readiness.html`: `outline-blue-500`
 * survived in 16 components after 0.12.0 moved Button onto the `--ring` token.
 * A focus ring that changes colour depending on which control has focus is an
 * accessibility finding before anyone measures a contrast ratio, and it is the
 * most visible theming leak a licensee will hit — their brand replacement
 * still gets Tailwind blue on every form control they ship.
 *
 * Import from here. Never write a literal ring colour in a component again;
 * `packages/tokens/scripts/presentation-lint.cjs` fails the build on
 * `outline-*-500` / `ring-*-500` / `ring-blue-*` literals.
 *
 * Three variants, because the components need three mechanisms — not because
 * they should look different. All three resolve to the same `--ring` token.
 */

/**
 * Default: native `:focus-visible` on a real focusable element.
 * Use for `<button>`, `<a>`, `<input>`, `<summary>` and anything else the
 * browser already tracks. This is the majority case.
 *
 * Replaces: `focus-visible:outline-2 focus-visible:outline-offset-2
 * focus-visible:outline-blue-500`
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Headless-UI variant: the library sets `data-focus` on the element rather
 * than relying on `:focus-visible`. `focus:not-data-focus:outline-hidden`
 * suppresses the native ring so the two mechanisms don't double up.
 *
 * Use in: avatar (AvatarButton), switch, dropdown items,
 * listbox / combobox options. BadgeButton uses {@link focusRing}.
 *
 * Replaces: `focus:not-data-focus:outline-hidden data-focus:outline-2
 * data-focus:outline-offset-2 data-focus:outline-blue-500`
 */
export const focusRingData =
  'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-ring';

/**
 * Group variant: the focusable element is a visually-hidden input and the ring
 * is drawn on a sibling indicator. Checkbox and Radio both work this way.
 *
 * Replaces: `group-data-focus:outline group-data-focus:outline-2
 * group-data-focus:outline-offset-2 group-data-focus:outline-blue-500`
 */
export const focusRingGroup =
  'group-data-focus:outline group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:outline-ring';

/**
 * Pseudo-element variant: for controls that already own their `outline` for
 * another purpose and paint the ring via `::after` (listbox and combobox
 * triggers). Kept separate so the offset stays inside the rounded corner.
 *
 * Replaces: `data-focus:after:ring-2 data-focus:after:ring-ring`
 */
export const focusRingAfter = 'data-focus:after:ring-2 data-focus:after:ring-ring';

/**
 * Native-focusable overlay trigger (Listbox button). The ring paints on
 * `::after` so the control can keep its own border. Use this when the host is
 * a real `<button>` / `<input>` — a `data-focus:` after-ring that nothing sets
 * is a dead recipe.
 */
export const focusRingAfterVisible = 'focus-visible:after:ring-2 focus-visible:after:ring-ring';

/**
 * Combobox control shell: ring when the inner input is focused.
 */
export const focusRingAfterWithin = 'sm:focus-within:after:ring-2 sm:focus-within:after:ring-ring';

/**
 * Host-on-descendant variant: the focusable child is visually stretched
 * (table row link) and hides its own outline. The row paints the `--ring`
 * when any descendant is `:focus-visible`. Prefer this over
 * `has-[[data-focus]]` so the ring does not depend on a hook attribute.
 */
export const focusRingHasVisible =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring';

/**
 * Active-option highlight inside menus and listboxes. Not a focus *ring* — the
 * filled row that follows keyboard navigation in Dropdown, Listbox and
 * Combobox. Token fill + on-fill ink so a brand replacement stays AA.
 */
export const activeOption = 'data-focus:bg-primary data-focus:text-primary-foreground';

/**
 * Forced-colors companion for {@link activeOption}. Highlight system colours,
 * not a palette step.
 */
export const activeOptionForced =
  'forced-color-adjust-none forced-colors:data-focus:bg-[Highlight] forced-colors:data-focus:text-[HighlightText]';

/**
 * Range-input thumb ring (Slider). Vendor pseudo-elements can't inherit the
 * classes above, so the selectors are spelled out.
 */
export const focusRingThumb =
  'focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-ring focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-offset-2 focus-visible:[&::-moz-range-thumb]:outline-ring';
