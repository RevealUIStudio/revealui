---
'@revealui/presentation': minor
---

Add an optional `animate="print"` prop to `ReceiptCard`. When set, each `AuditLine` row and the integrity footer play a one-shot CSS entrance stagger (the receipt "prints" itself line by line), and the integrity footer's seal pulses once after its entrance. Pure CSS, no JS timeline. Disabled under `prefers-reduced-motion: reduce`. Default is unchanged (no `animate` prop = no visual change).
