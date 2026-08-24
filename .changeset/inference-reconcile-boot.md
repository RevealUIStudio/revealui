---
"@revealui/harnesses": patch
---

Add a user systemd oneshot that runs `inference reconcile` at WSL boot so unsigned or unfit snaps cannot persist via `snap start --enable`.
