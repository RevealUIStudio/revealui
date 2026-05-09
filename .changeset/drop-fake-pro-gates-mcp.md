---
'@revealui/mcp': minor
---

Remove unused `checkMcpLicense` export and all 11 per-server gate call sites. Per
the 2026-05-08 charge-readiness audit Phase 2 Path A: the gates were theater —
`MCPHypervisor`, `MCPClient`, and `createMCPAdapter` shipped ungated regardless;
bypass was "import the class directly, never call `launchXMcp`." Drop the gates.

License normalized from MIT to FSL-1.1-MIT: a runtime tier check was incoherent
with MIT's "use without restriction" grant. LICENSE file added to the package.
