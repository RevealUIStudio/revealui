---
"@revealui/config": patch
"@revealui/db": patch
"@revealui/auth": patch
"@revealui/core": patch
"@revealui/mcp": patch
---

Resolve the application database URL in one function so the pool, client, and auth storage cannot select different databases.
