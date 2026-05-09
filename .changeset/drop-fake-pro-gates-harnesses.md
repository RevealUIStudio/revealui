---
'@revealui/harnesses': minor
---

Remove `checkHarnessesLicense` export and all CLI gate call sites (import, pull
tier check, main gate). Per the 2026-05-08 charge-readiness audit Phase 2 Path A:
the CLI gate was theater — library exports (`HarnessCoordinator`, `HarnessRegistry`,
`RpcServer`, etc.) were always ungated; the gate only applied to the CLI entrypoint,
which customers could bypass by importing directly. Drop the gate. Strip the `[Pro]`
description prefix to match enforcement reality.
