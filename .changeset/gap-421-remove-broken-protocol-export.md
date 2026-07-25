---
'@revealui/harnesses': minor
---

Remove the `./protocol` subpath export. It was mapped in `package.json` but never listed in `tsup.config.ts`, so `dist/protocol/` never existed and the export 404'd (`ERR_MODULE_NOT_FOUND`) for anyone who tried it. GAP-421's routing audit found zero consumers of the subpath fleet-wide; protocol types, schemas, and factories remain available via the root `@revealui/harnesses` export, which already re-exports them.
