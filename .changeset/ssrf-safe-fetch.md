---
"@revealui/security": minor
"@revealui/mcp": minor
---

Harden server-side fetches of user/tenant-supplied URLs against SSRF.

`@revealui/security` gains `createSafeFetch()` — a `fetch` that validates the
target resolves to a public IP and pins the connection to that IP via an undici
dispatcher whose lookup re-validates at dial time (closing the DNS-rebinding
TOCTOU that a bare `assertPublicUrl` + `fetch` leaves open), and refuses
redirects (a classic SSRF-guard bypass). `assertPublicUrl()` now returns the
validated public IPs and additionally blocks bracketed-IPv6 literals and
hex-form IPv4-mapped loopback/private literals (e.g. `::ffff:7f00:1`) that the
prior check missed.

`@revealui/mcp` routes every remote MCP server connection through this guard in
`buildRemoteMcpClient` (validating the stored server URL and pinning the
transport's fetch). The API marketplace proxy and the admin MCP OAuth initiate
flow now reject private/metadata/loopback targets instead of connecting to them.
