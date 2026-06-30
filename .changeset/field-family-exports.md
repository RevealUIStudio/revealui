---
"@revealui/presentation": minor
---

Make the Field-context form family canonical and fully consumable, brand-tokenize the field + headless-control internals.

- Exports (additive, non-breaking): the full field-context family (`Field`/`Description`/`ErrorMessage`/`Fieldset`/`Legend`/`FieldGroup` + the context `Label`) is now reachable from the main entry and `/client`; the context-aware `Label` is the canonical bare `Label` on `/client` (mirrors the `Text`/`Heading` Catalyst precedent). The simple label is also exported everywhere as `ControlLabel`, and as `FieldLabel` (context label) from the main entry. Bare `Label` on `.`/`/server` remains the simple, server-safe label, so existing standalone `Label`/`FormLabel`/`FormField` consumers are unchanged. `FieldsetLabel` retained as a `/client` back-compat alias.
- Tokens: `fieldset` (Legend/Label/Description/ErrorMessage) and `form-field` (description/error) + the headless control internals (`input`/`select`/`textarea`-headless) move off raw `zinc`/`blue`/`red` onto brand bridge tokens (`text-foreground`/`text-muted-foreground`/`text-destructive`/`ring`/`border`), matching the Card/Text migration.
- Canonical form pattern is now `<Field><Label/><headless Input|Select|Textarea/><Description/><ErrorMessage/></Field>` (context-driven id/aria). The standalone `FormLabel`/`FormField` + CVA controls are kept for the styled-control path.
