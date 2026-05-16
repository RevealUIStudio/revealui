---
"@revealui/presentation": patch
---

`Button` / `LinkButton` (CVA variants): bump vertical sizing on all size variants so text and icons have more breathing room inside the rounded outline.

- `default`: `h-10` → `h-11`, added `py-2.5`
- `lg`: `h-11` → `h-12`, added `py-3`
- `sm`: `h-9` → `h-10`, added `py-2`
- `icon`: `size-10` → `size-11` (kept square; matches new `default` height for inline alignment)

No API changes. Existing consumers see slightly taller buttons (44–48px instead of 40–44px), which matches modern hit-target conventions and gives the rounded edge (`var(--rvui-radius-md, 10px)`) enough room to read as a deliberate shape rather than a cramped pill.
