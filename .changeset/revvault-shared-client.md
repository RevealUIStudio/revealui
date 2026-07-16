---
"@revealui/setup": minor
"@revealui/mcp": patch
---

Add a shared `revvault` CLI client at `@revealui/setup/revvault`, consolidating
the six hand-rolled `revvault` spawn implementations across the MCP OAuth
provider and the setup/admin/probe scripts into one module. Adds a fail-fast
`requireRevvaultSecret` helper that throws naming the exact vault path when a
secret is missing, alongside tolerant (`readRevvaultSecret`) and write
(`writeRevvaultSecret`, `revvaultSecretExists`) variants for scripts that
previously reimplemented their own spawn + error handling. `@revealui/mcp`'s
OAuth provider now consumes the shared client with no change to its public
API or behavior.
