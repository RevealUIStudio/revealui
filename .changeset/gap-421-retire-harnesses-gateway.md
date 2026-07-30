---
"@revealui/harnesses": minor
---

Retire the dead HTTP gateway twin and PGlite DaemonStore from `@revealui/harnesses` after the RevDev port (revdev#328/#329). Remote pairing lives only in `@revdev/daemon`. Breaking: removes `./storage` export and root `DaemonStore` / `SCHEMA_SQL` re-exports.
