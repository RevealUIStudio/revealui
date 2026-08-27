# Fields family anatomy (Phase 3 leftover)

Input, Select, Textarea, Checkbox, Radio, Switch, Slider, Fieldset / Field.
Grounded in admin forms + docs showcase, WAI-ARIA APG textbox / checkbox /
radio / switch / slider, and `@revealui/tokens`. Catalyst source was not open
while writing this. Existing package tests define behavioral compatibility.

Switch, Radio, Checkbox, and Progress already ship semantic `intent` (0.13.0).
This pass authors the **shared focus recipes** onto the remaining text
controls and Slider, and records the field-context contract.

## Shared contract

| Concern | Rule |
|---|---|
| Focus ring | `focus.ts` only. Same `--ring` token as Button. |
| Tokens | `text-foreground`, `placeholder:text-muted-foreground`, `border-input`, `bg-card`. No palette steps. No `dark:` pairs. |
| Invalid | `data-invalid` + `border-destructive`. Native `aria-invalid` on CVA hosts. |
| Field context | Canonical compose is `<Field><Label/><Input\|Select\|Textarea/><Description/><ErrorMessage/></Field>`. Ids and `aria-*` come from `useFieldControlProps`. |
| Motion | Border / ring transitions honour `--rvui-duration-normal` / `--rvui-ease`. |

`data-hover` / `data-disabled` on headless hosts come from `useDataInteractive`.
Class recipes for those markers stay on the control; the ring does not.

## Text controls (APG Textbox)

| Part | Role |
|---|---|
| Shell | `data-slot="control"` span. Paints `::before` surface + `::after` ring. |
| Input | real `<input>` / `<textarea>` / `<select>` |

Focus:

- Input / Textarea shell → `focusRingAfterWithin` (`:focus-within` on the shell).
- Select shell → `focusRingHasData` (the native `<select>` carries `data-focus`
  from `useDataInteractive`; the ring lives on the shell `::after`).

Do not restore a `dark:before:hidden` pair. The `::before` card surface is a
token (`bg-card`) and inverts with `[data-theme]`.

## Checkbox / Radio / Switch

Already on semantic `intent` (`brand | neutral | success | warning | danger`)
with `focusRingGroup` (Checkbox, Radio) or `focusRingData` (Switch). Default
intent is `brand`. Deprecated `color` maps through `resolveIntent` until 0.15.

## Slider (APG Slider)

Native `<input type="range">`. Thumb ring is `focusRingThumb` (WebKit +
Mozilla vendor pseudos, `--ring` token).

## Fieldset / Field

`Field` / `Fieldset` / `Legend` / `Label` / `Description` / `ErrorMessage`
are layout + naming. They do not paint a focus ring. Error copy is
`text-destructive`.

## Do-not-redo

The dual headless + CVA export (bare `Input` is headless; `InputCVA` is the
styled host) stays. This pass does not collapse the two APIs or redesign
the control chrome. CVA Input keeps the tenant-brand ring override
(`--tenant-brand` falling back to `--ring`).
